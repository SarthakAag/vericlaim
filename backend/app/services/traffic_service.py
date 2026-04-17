"""
Traffic Service — VeriClaim AI Platform
Guidewire DEVTrails 2026

Priority chain:
  1. DEMO_MODE=true           → fixed heavy-traffic scenario for judges
  2. TOMTOM_API_KEY present   → TomTom Traffic Flow API (free, no credit card)
                                 2,500 req/day free — https://developer.tomtom.com
  3. Smart fallback           → Chennai zone-aware + peak-hour + monsoon logic
                                 Deterministic, never random()

TomTom Flow Segment API:
  GET https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json
  Params: point=lat,lon  key=YOUR_KEY
  Returns: currentSpeed, freeFlowSpeed → congestion ratio derived from these two
"""

from __future__ import annotations

import logging
import os
from datetime import datetime
from typing import Optional

import requests

logger = logging.getLogger(__name__)

# ─── Config ───────────────────────────────────────────────────────────────────
TOMTOM_KEY = os.getenv("TOMTOM_API_KEY", "")
DEMO_MODE  = os.getenv("DEMO_MODE", "false").lower() == "true"
TIMEOUT    = int(os.getenv("TRAFFIC_API_TIMEOUT_S", "5"))

_TOMTOM_URL = (
    "https://api.tomtom.com/traffic/services/4"
    "/flowSegmentData/absolute/10/json"
)

# ─── Chennai zone → (lat, lon) ────────────────────────────────────────────────
ZONE_COORDS: dict[str, tuple[float, float]] = {
    "anna_nagar":  (13.0850, 80.2101),
    "t_nagar":     (13.0418, 80.2341),
    "velachery":   (12.9815, 80.2180),
    "adyar":       (13.0012, 80.2565),
    "porur":       (13.0358, 80.1560),
    "omr":         (12.9010, 80.2279),
    "mylapore":    (13.0368, 80.2676),
    "tambaram":    (12.9249, 80.1000),
    "default":     (13.0827, 80.2707),   # Chennai Central
}

# ─── Chennai zone baseline delays (minutes) — from real patterns ──────────────
ZONE_BASE_DELAY: dict[str, int] = {
    "t_nagar":    20,   # perpetually congested — shopping hub
    "anna_nagar": 12,
    "velachery":  15,   # OMR junction bottleneck
    "adyar":      10,
    "porur":      18,   # NH48 merge point
    "omr":        14,   # tech corridor
    "mylapore":   12,
    "tambaram":   10,
    "default":    12,
}

# ─── Peak-hour multipliers for Chennai ────────────────────────────────────────
def _peak_multiplier(hour: int, weekday: int) -> float:
    if weekday >= 5:        return 1.2
    if  7 <= hour <= 10:   return 2.2   # morning rush
    if 17 <= hour <= 20:   return 2.5   # evening rush — worst in Chennai
    if 20 <= hour <= 22:   return 1.4   # food delivery peak
    if 11 <= hour <= 16:   return 1.3   # midday
    return 1.0

# ─── Monsoon multiplier (NE monsoon: Oct–Dec, SW: Jun–Sep) ────────────────────
def _monsoon_multiplier(month: int) -> float:
    return {10: 1.6, 11: 1.8, 12: 1.4, 6: 1.2, 7: 1.3, 8: 1.3, 9: 1.2}.get(month, 1.0)


# ══════════════════════════════════════════════════════════════════════════════
def get_traffic_data(
    origin:      Optional[str] = None,
    destination: Optional[str] = None,
) -> dict:
    """
    Returns a normalised traffic dict consumed by DelayDetectionService.

    Resolution order:
      DEMO_MODE=true      → flood/heavy demo payload
      TOMTOM_KEY set      → live TomTom Traffic Flow API
      fallback            → Chennai zone + peak-hour + monsoon estimate
    """
    if DEMO_MODE:
        logger.info("[Traffic] DEMO_MODE — returning flood/heavy payload")
        return _demo_payload()

    if TOMTOM_KEY and TOMTOM_KEY not in ("YOUR_TOMTOM_API_KEY", ""):
        lat, lon = _resolve_coords(origin)
        result   = _call_tomtom(lat, lon)
        if result:
            return result
        logger.warning("[Traffic] TomTom API failed — using smart fallback")
    else:
        logger.info("[Traffic] No TomTom key — using smart fallback")

    return _smart_fallback(origin)


# ─── Legacy single-field helper ───────────────────────────────────────────────
def get_traffic(origin: Optional[str] = None) -> str:
    """Returns 'heavy'/'moderate'/'normal' — kept for backward compatibility."""
    return get_traffic_data(origin=origin).get("congestion_level", "moderate")


# ──────────────────────────────────────────────────────────────────────────────
# LIVE API — TomTom Traffic Flow
# ──────────────────────────────────────────────────────────────────────────────

def _call_tomtom(lat: float, lon: float) -> dict | None:
    """
    Calls TomTom Flow Segment Data endpoint.
    Derives congestion from currentSpeed / freeFlowSpeed ratio.

    Ratio interpretation:
      >= 0.85  → normal     (< 15% slowdown)
      >= 0.65  → light
      >= 0.45  → moderate
      >= 0.25  → heavy
      <  0.25  → gridlock
    """
    params = {
        "point": f"{lat},{lon}",
        "key":   TOMTOM_KEY,
    }
    try:
        resp = requests.get(_TOMTOM_URL, params=params, timeout=TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
    except requests.exceptions.Timeout:
        logger.warning(f"[Traffic] TomTom timeout after {TIMEOUT}s")
        return None
    except requests.exceptions.RequestException as exc:
        logger.warning(f"[Traffic] TomTom request failed: {exc}")
        return None
    except Exception as exc:
        logger.warning(f"[Traffic] Unexpected error: {exc}")
        return None

    flow = data.get("flowSegmentData")
    if not flow:
        logger.warning("[Traffic] TomTom returned no flowSegmentData")
        return None

    current_speed   = float(flow.get("currentSpeed",  0))
    free_flow_speed = float(flow.get("freeFlowSpeed", max(current_speed, 1)))
    confidence      = float(flow.get("confidence",    0))

    ratio = current_speed / free_flow_speed if free_flow_speed > 0 else 1.0

    if   ratio >= 0.85: congestion = "normal"
    elif ratio >= 0.65: congestion = "light"
    elif ratio >= 0.45: congestion = "moderate"
    elif ratio >= 0.25: congestion = "heavy"
    else:               congestion = "gridlock"

    # Estimate delay — avg Chennai delivery distance ~3km
    avg_distance_km = 3.0
    if current_speed > 0:
        free_flow_min = (avg_distance_km / free_flow_speed) * 60
        actual_min    = (avg_distance_km / current_speed)   * 60
        delay_minutes = max(0, int(actual_min - free_flow_min))
    else:
        delay_minutes = 60

    # TomTom flow doesn't expose incidents — infer from extreme congestion + monsoon
    month         = datetime.now().month
    road_closure  = ratio < 0.20 and month in (10, 11)
    incident_type = "flood" if road_closure else None

    logger.info(
        f"[Traffic] TomTom live — {current_speed}/{free_flow_speed} km/h "
        f"ratio={ratio:.2f} → {congestion} delay={delay_minutes}min"
    )

    return {
        "congestion_level":    congestion,
        "delay":               delay_minutes,
        "road_closure":        road_closure,
        "incident_type":       incident_type,
        "current_speed_kmh":   current_speed,
        "free_flow_speed_kmh": free_flow_speed,
        "congestion_ratio":    round(ratio, 3),
        "confidence":          confidence,
        "source":              "live_tomtom",
    }


# ──────────────────────────────────────────────────────────────────────────────
# SMART FALLBACK — deterministic, no random()
# ──────────────────────────────────────────────────────────────────────────────

def _smart_fallback(origin: Optional[str] = None) -> dict:
    """
    Deterministic Chennai traffic estimate.
    zone_base_delay × peak_hour_multiplier × monsoon_multiplier.

    Example: T Nagar at 6pm in November
      20min × 2.5 × 1.8 = 90min → gridlock
    """
    now      = datetime.now()
    zone_key = (origin or "").lower().replace(" ", "_")

    base_delay   = ZONE_BASE_DELAY.get(zone_key, ZONE_BASE_DELAY["default"])
    peak_mult    = _peak_multiplier(now.hour, now.weekday())
    monsoon_mult = _monsoon_multiplier(now.month)

    estimated_delay = int(base_delay * peak_mult * monsoon_mult)

    if   estimated_delay >= 50: congestion = "gridlock"
    elif estimated_delay >= 30: congestion = "heavy"
    elif estimated_delay >= 15: congestion = "moderate"
    elif estimated_delay >= 8:  congestion = "light"
    else:                       congestion = "normal"

    road_closure  = False
    incident_type = None
    if now.month in (10, 11) and estimated_delay >= 40:
        road_closure  = True
        incident_type = "flood"
    elif estimated_delay >= 55:
        road_closure  = True
        incident_type = "accident"

    logger.info(
        f"[Traffic] Smart fallback — zone={zone_key} "
        f"delay={estimated_delay}min → {congestion}"
    )

    return {
        "congestion_level": congestion,
        "delay":            estimated_delay,
        "road_closure":     road_closure,
        "incident_type":    incident_type,
        "source":           "smart_fallback",
        "fallback_context": {
            "zone":         zone_key,
            "base_delay":   base_delay,
            "peak_mult":    peak_mult,
            "monsoon_mult": monsoon_mult,
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _resolve_coords(location: Optional[str]) -> tuple[float, float]:
    if not location:
        return ZONE_COORDS["default"]
    key = location.lower().replace(" ", "_")
    return ZONE_COORDS.get(key, ZONE_COORDS["default"])


def _demo_payload() -> dict:
    return {
        "congestion_level": "heavy",
        "delay":            45,
        "road_closure":     True,
        "incident_type":    "flood",
        "source":           "demo_mode",
    }