"""
Weather Service — VeriClaim AI Platform
Guidewire DEVTrails 2026

Priority chain:
  1. Live WeatherAPI.com  (real key in .env)
  2. Chennai seasonal fallback  (month-aware, never just "clear")

DEMO_MODE is now an env var — flip it without touching code:
  DEMO_MODE=true  →  returns heavy-rain scenario for judges
  DEMO_MODE=false →  hits real WeatherAPI
"""

from __future__ import annotations

import logging
import os
from datetime import datetime

import requests

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────
API_KEY   = os.getenv("WEATHER_API_KEY", "")
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() == "true"
TIMEOUT   = int(os.getenv("WEATHER_API_TIMEOUT_S", "5"))

# WeatherAPI base — include air_quality=yes so we get AQI in one call
_BASE_URL = "http://api.weatherapi.com/v1/current.json"

# ─── Chennai zone → (lat, lon) lookup ─────────────────────────────────────────
ZONE_COORDS: dict[str, tuple[float, float]] = {
    "anna_nagar":  (13.0850, 80.2101),
    "t_nagar":     (13.0418, 80.2341),
    "velachery":   (12.9815, 80.2180),
    "adyar":       (13.0012, 80.2565),
    "porur":       (13.0358, 80.1560),
    "omr":         (12.9010, 80.2279),
    "mylapore":    (13.0368, 80.2676),
    "tambaram":    (12.9249, 80.1000),
    "default":     (13.0827, 80.2707),  # Chennai Central
}

# ─── Chennai monthly seasonal baseline (fallback data) ────────────────────────
#     Northeast monsoon: Oct–Dec  |  Southwest monsoon: Jun–Sep
_MONTHLY_BASELINE: dict[int, dict] = {
    1:  {"condition": "clear",       "rain_mm_per_hr": 0,  "wind_kmh": 12, "temperature_c": 28, "aqi": 75,  "visibility_m": 6000, "humidity": 65},
    2:  {"condition": "clear",       "rain_mm_per_hr": 0,  "wind_kmh": 14, "temperature_c": 30, "aqi": 70,  "visibility_m": 6500, "humidity": 62},
    3:  {"condition": "partly cloudy","rain_mm_per_hr": 1, "wind_kmh": 15, "temperature_c": 33, "aqi": 80,  "visibility_m": 5500, "humidity": 68},
    4:  {"condition": "partly cloudy","rain_mm_per_hr": 2, "wind_kmh": 18, "temperature_c": 36, "aqi": 85,  "visibility_m": 5000, "humidity": 72},
    5:  {"condition": "partly cloudy","rain_mm_per_hr": 3, "wind_kmh": 20, "temperature_c": 38, "aqi": 90,  "visibility_m": 4500, "humidity": 75},
    6:  {"condition": "light rain",  "rain_mm_per_hr": 8,  "wind_kmh": 25, "temperature_c": 34, "aqi": 65,  "visibility_m": 3500, "humidity": 85},
    7:  {"condition": "moderate rain","rain_mm_per_hr": 15,"wind_kmh": 28, "temperature_c": 32, "aqi": 60,  "visibility_m": 3000, "humidity": 88},
    8:  {"condition": "moderate rain","rain_mm_per_hr": 18,"wind_kmh": 26, "temperature_c": 31, "aqi": 62,  "visibility_m": 3000, "humidity": 89},
    9:  {"condition": "light rain",  "rain_mm_per_hr": 10, "wind_kmh": 22, "temperature_c": 31, "aqi": 68,  "visibility_m": 3800, "humidity": 86},
    10: {"condition": "heavy rain",  "rain_mm_per_hr": 35, "wind_kmh": 30, "temperature_c": 29, "aqi": 72,  "visibility_m": 2500, "humidity": 92},
    11: {"condition": "heavy rain",  "rain_mm_per_hr": 45, "wind_kmh": 35, "temperature_c": 27, "aqi": 78,  "visibility_m": 2000, "humidity": 93},
    12: {"condition": "moderate rain","rain_mm_per_hr": 20,"wind_kmh": 25, "temperature_c": 26, "aqi": 74,  "visibility_m": 3000, "humidity": 88},
}


# ══════════════════════════════════════════════════════════════════════════════
def get_weather_data(
    location: str | None = None,
    lat: float = 13.0827,
    lon: float = 80.2707,
) -> dict:
    """
    Returns a normalised weather dict consumed by DelayDetectionService.

    Resolution order:
      DEMO_MODE=true  → heavy-rain demo payload
      API_KEY present → live WeatherAPI call (with AQI)
      fallback        → Chennai monthly seasonal baseline
    """
    if DEMO_MODE:
        logger.info("[Weather] DEMO_MODE — returning heavy-rain payload")
        return _demo_payload()

    # Resolve location string → coordinates
    if location:
        coords = ZONE_COORDS.get(location.lower().replace(" ", "_"))
        if coords:
            lat, lon = coords

    if API_KEY and API_KEY not in ("YOUR_API_KEY", ""):
        result = _call_weatherapi(lat, lon)
        if result:
            return result
        logger.warning("[Weather] Live API failed — using seasonal fallback")
    else:
        logger.warning("[Weather] No API key configured — using seasonal fallback")

    return _seasonal_fallback()


# ─── Legacy single-field helper (used by older callers) ──────────────────────
def get_weather(lat: float = 13.0827, lon: float = 80.2707) -> str:
    """Returns 'rain' or 'normal' — kept for backward compatibility."""
    data = get_weather_data(lat=lat, lon=lon)
    rain_keywords = ("rain", "drizzle", "storm", "thunder", "shower", "flood")
    return "rain" if any(k in data["condition"] for k in rain_keywords) else "normal"


# ──────────────────────────────────────────────────────────────────────────────
# LIVE API
# ──────────────────────────────────────────────────────────────────────────────

def _call_weatherapi(lat: float, lon: float) -> dict | None:
    """
    Single call to WeatherAPI — fetches current conditions + AQI.
    Returns None on any failure so caller can fall through to fallback.
    """
    params = {
        "key": API_KEY,
        "q":   f"{lat},{lon}",
        "aqi": "yes",   # ← air quality included at no extra cost
    }
    try:
        resp = requests.get(_BASE_URL, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.Timeout:
        logger.warning(f"[Weather] API timeout after {TIMEOUT}s")
        return None
    except requests.exceptions.RequestException as exc:
        logger.warning(f"[Weather] API request failed: {exc}")
        return None
    except Exception as exc:
        logger.warning(f"[Weather] Unexpected error: {exc}")
        return None

    current = data.get("current", {})
    if not current:
        logger.warning("[Weather] API returned empty current block")
        return None

    # ── AQI — WeatherAPI returns EPA index under air_quality ─────────────────
    aqi_block = current.get("air_quality", {})
    # us-epa-index: 1=Good … 6=Hazardous  →  map to approximate µg/m³ midpoint
    epa_to_aqi = {1: 25, 2: 75, 3: 125, 4: 175, 5: 250, 6: 350}
    epa_idx = int(aqi_block.get("us-epa-index", 1))
    aqi = epa_to_aqi.get(epa_idx, aqi_block.get("pm2_5", 80))

    return {
        "condition":      current.get("condition", {}).get("text", "clear").lower(),
        "rain_mm_per_hr": float(current.get("precip_mm", 0)),
        "wind_kmh":       float(current.get("wind_kph", 0)),
        "temperature_c":  float(current.get("temp_c", 30)),
        "aqi":            int(aqi),
        "visibility_m":   int(current.get("vis_km", 5) * 1000),
        "humidity":       int(current.get("humidity", 70)),
        "source":         "live_weatherapi",
    }


# ──────────────────────────────────────────────────────────────────────────────
# FALLBACKS
# ──────────────────────────────────────────────────────────────────────────────

def _seasonal_fallback() -> dict:
    """Month-aware Chennai baseline — always realistic, never hardcoded 'clear'."""
    month   = datetime.now().month
    payload = dict(_MONTHLY_BASELINE.get(month, _MONTHLY_BASELINE[1]))
    payload["source"] = "seasonal_fallback"
    logger.info(f"[Weather] Seasonal fallback — month={month} → {payload['condition']}")
    return payload


def _demo_payload() -> dict:
    return {
        "condition":      "heavy rain",
        "rain_mm_per_hr": 42,
        "wind_kmh":       35,
        "temperature_c":  27,
        "aqi":            145,
        "visibility_m":   1800,
        "humidity":       94,
        "source":         "demo_mode",
    }