from fastapi import APIRouter
from app.utils.chennai_locations import chennai_locations
from app.services.ml_risk_model import get_model, ZONE_RISK

router = APIRouter()

# Zone flood risk values (must match CHENNAI_ZONE_RISK in ai_delay_predictor)
ZONE_RISK: dict[str, float] = {
    "velachery":    0.90,
    "adyar":        0.85,
    "porur":        0.75,
    "tambaram":     0.70,
    "chromepet":    0.60,
    "kodambakkam":  0.65,
    "perambur":     0.55,
    "t_nagar":      0.50,
    "anna_nagar":   0.40,
    "guindy":       0.45,
    "omr":          0.55,
    "default":      0.50,
}

AREA_TO_ZONE: dict[str, str] = {
    "Velachery":  "velachery",
    "Adyar":      "adyar",
    "Porur":      "porur",
    "Tambaram":   "tambaram",
    "T Nagar":    "t_nagar",
    "Anna Nagar": "anna_nagar",
    "Guindy":     "guindy",
    "OMR":        "omr",
}

# Zone-based weather profiles — no API needed
def _zone_weather(zone_risk: float) -> dict:
    if zone_risk >= 0.85:        # Critical: Velachery, Adyar
        return {
            "rain_mm_per_hr": 70.0,
            "temperature_c":  28.0,
            "aqi":            180,
            "wind_kmh":       45.0,
            "visibility_m":   150.0,
        }
    elif zone_risk >= 0.70:      # High: Porur, Tambaram
        return {
            "rain_mm_per_hr": 38.0,
            "temperature_c":  29.0,
            "aqi":            140,
            "wind_kmh":       30.0,
            "visibility_m":   500.0,
        }
    elif zone_risk >= 0.55:      # Medium: Chromepet, Kodambakkam, OMR
        return {
            "rain_mm_per_hr": 18.0,
            "temperature_c":  31.0,
            "aqi":            100,
            "wind_kmh":       20.0,
            "visibility_m":   2000.0,
        }
    else:                        # Low: T Nagar, Anna Nagar, Guindy
        return {
            "rain_mm_per_hr": 2.0,
            "temperature_c":  33.0,
            "aqi":            60,
            "wind_kmh":       12.0,
            "visibility_m":   8000.0,
        }


def _normalize_risk(delay_level: str) -> str:
    return {
        "critical": "high",
        "high":     "high",
        "moderate": "medium",
        "low":      "low",
    }.get(delay_level, "low")


@router.get("/risk-map")
def get_risk_map():
    model   = get_model()
    results = []

    for loc in chennai_locations:
        area      = loc["area"]
        zone_key  = AREA_TO_ZONE.get(area, "default")
        zone_risk = ZONE_RISK.get(zone_key, 0.50)
        weather   = _zone_weather(zone_risk)

        try:
            result = model.predict_from_dicts(
                weather            = weather,
                traffic            = {
                    "congestion_level": "moderate",
                    "delay":            15,
                    "road_closure":     False,
                },
                driver_speed       = 15.0,
                distance_remaining = 3.0,
                zone_flood_risk    = zone_risk,
                hist_avg_speed     = 22.0,
                driver_location    = zone_key,
            )
            delay_level = result.get("delay_level", "low")
            risk_score  = result.get("risk_score",  0.0)
            trigger     = result.get("parametric_trigger", {})

        except Exception as e:
            print(f"[risk-map] prediction failed for {area}: {e}")
            delay_level = "low"
            risk_score  = 0.0
            trigger     = {}

        results.append({
            "area":          area,
            "lat":           loc["lat"],
            "lon":           loc["lon"],
            "risk":          _normalize_risk(delay_level),
            "risk_score":    risk_score,
            "delay_level":   delay_level,
            "trigger_fired": trigger.get("triggered", False),
            "payout_tier":   trigger.get("payout_tier", "none"),
            "weather":       weather,
            "zone_risk":     zone_risk,
        })

    return results