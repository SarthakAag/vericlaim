"""
ML Risk Model — Drop-in Replacement for Weighted Scoring
Guidewire DEVTrails 2026 — GigShield Parametric Insurance Platform
Persona: Food Delivery Partners (Zomato / Swiggy) — Chennai

Replaces the hand-crafted weighted ensemble in ai_delay_predictor.py
with three trained scikit-learn models:

  risk_score_model.pkl    RandomForest Regressor     R²=0.98  MAE=3.1
  delay_level_model.pkl   GradientBoosting Classifier Acc=91.9% F1=0.90
  trigger_model.pkl       Calibrated RF Classifier    AUC=1.00 Prec=0.999
"""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Optional

import joblib
import numpy as np
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# ─── Model paths — points to backend/models/ ─────────────────────────────────
_BASE  = os.path.dirname(os.path.abspath(__file__))   # .../app/services/
_MDIR  = os.path.join(_BASE, "..", "..", "models")    # .../backend/models/

_RISK_MODEL_PATH    = os.path.join(_MDIR, "risk_score_model.pkl")
_DELAY_MODEL_PATH   = os.path.join(_MDIR, "delay_level_model.pkl")
_TRIGGER_MODEL_PATH = os.path.join(_MDIR, "trigger_model.pkl")
_METADATA_PATH      = os.path.join(_MDIR, "model_metadata.json")

# ─── Zone flood risk ──────────────────────────────────────────────────────────
ZONE_RISK: dict[str, float] = {
    "velachery":   0.90,
    "adyar":       0.85,
    "porur":       0.75,
    "tambaram":    0.70,
    "chromepet":   0.60,
    "kodambakkam": 0.65,
    "perambur":    0.55,
    "t_nagar":     0.50,
    "anna_nagar":  0.40,
    "guindy":      0.45,
    "omr":         0.55,
    "default":     0.50,
}

# ─── Food Delivery Zone Profiles (Zomato/Swiggy specific) ────────────────────
FOOD_DELIVERY_ZONE_PROFILE: dict[str, dict] = {
    "velachery":   {"flood_risk": 0.90, "restaurant_density": "high",      "avg_order_value": 280, "avg_daily_orders": 18},
    "adyar":       {"flood_risk": 0.85, "restaurant_density": "high",      "avg_order_value": 380, "avg_daily_orders": 20},
    "t_nagar":     {"flood_risk": 0.50, "restaurant_density": "very_high", "avg_order_value": 350, "avg_daily_orders": 22},
    "omr":         {"flood_risk": 0.55, "restaurant_density": "medium",    "avg_order_value": 420, "avg_daily_orders": 15},
    "anna_nagar":  {"flood_risk": 0.40, "restaurant_density": "high",      "avg_order_value": 310, "avg_daily_orders": 20},
    "porur":       {"flood_risk": 0.75, "restaurant_density": "medium",    "avg_order_value": 260, "avg_daily_orders": 14},
    "tambaram":    {"flood_risk": 0.70, "restaurant_density": "medium",    "avg_order_value": 240, "avg_daily_orders": 16},
    "chromepet":   {"flood_risk": 0.60, "restaurant_density": "low",       "avg_order_value": 220, "avg_daily_orders": 13},
    "kodambakkam": {"flood_risk": 0.65, "restaurant_density": "medium",    "avg_order_value": 270, "avg_daily_orders": 15},
    "perambur":    {"flood_risk": 0.55, "restaurant_density": "low",       "avg_order_value": 210, "avg_daily_orders": 12},
    "guindy":      {"flood_risk": 0.45, "restaurant_density": "medium",    "avg_order_value": 290, "avg_daily_orders": 16},
    "default":     {"flood_risk": 0.50, "restaurant_density": "medium",    "avg_order_value": 280, "avg_daily_orders": 15},
}

# ─── Zone-based weather profiles — no API needed ─────────────────────────────
def _zone_weather(zone_risk: float) -> dict:
    """
    Generate realistic weather features purely from zone flood risk.
    Eliminates dependency on weather API entirely.
    """
    if zone_risk >= 0.85:        # Critical: Velachery, Adyar
        return {"rain_mm_per_hr": 70.0, "temperature_c": 28.0, "aqi": 180, "wind_kmh": 45.0, "visibility_m": 150.0}
    elif zone_risk >= 0.70:      # High: Porur, Tambaram
        return {"rain_mm_per_hr": 38.0, "temperature_c": 29.0, "aqi": 140, "wind_kmh": 30.0, "visibility_m": 500.0}
    elif zone_risk >= 0.55:      # Medium: Chromepet, Kodambakkam, OMR, Perambur
        return {"rain_mm_per_hr": 18.0, "temperature_c": 31.0, "aqi": 100, "wind_kmh": 20.0, "visibility_m": 2000.0}
    else:                        # Low: T Nagar, Anna Nagar, Guindy
        return {"rain_mm_per_hr": 2.0,  "temperature_c": 33.0, "aqi": 60,  "wind_kmh": 12.0, "visibility_m": 8000.0}


# ─── Level labels ─────────────────────────────────────────────────────────────
LEVEL_LABELS = {0: "low", 1: "moderate", 2: "high", 3: "critical"}
LEVEL_INT    = {"low": 0, "moderate": 1, "high": 2, "critical": 3}

# ─── Congestion string → int ──────────────────────────────────────────────────
CONGESTION_MAP   = {"low": 0, "moderate": 1, "heavy": 2, "gridlock": 3}
CONGESTION_DELAY = {"low": 5, "moderate": 15, "heavy": 30, "gridlock": 60}

# ─── Parametric thresholds (must match training thresholds) ───────────────────
THRESHOLDS = {
    "rain_extreme_mm":   65,
    "rain_heavy_mm":     35,
    "rain_moderate_mm":  15,
    "wind_high_kmh":     40,
    "temp_extreme_c":    42,
    "aqi_severe":       300,
    "visibility_low_m": 200,
}

# ─── Trigger config — weather + food delivery specific ───────────────────────
TRIGGER_CONFIG = {
    # ── Environmental triggers ────────────────────────────────────────────────
    "extreme_rain":  {"coverage_hours": 4, "payout_tier": "full"},
    "heavy_rain":    {"coverage_hours": 2, "payout_tier": "partial"},
    "severe_heat":   {"coverage_hours": 3, "payout_tier": "partial"},
    "severe_aqi":    {"coverage_hours": 2, "payout_tier": "partial"},
    "road_closure":  {"coverage_hours": 3, "payout_tier": "partial"},

    # ── Food delivery-specific triggers (Zomato/Swiggy) ──────────────────────
    "platform_app_outage":       {"coverage_hours": 2, "payout_tier": "partial"},
    # Zomato/Swiggy app down → zero orders, zero income

    "restaurant_zone_closure":   {"coverage_hours": 3, "payout_tier": "partial"},
    # Government-ordered restaurant area shutdown

    "night_curfew":              {"coverage_hours": 4, "payout_tier": "full"},
    # Curfew after 10 PM — no deliveries possible

    "festival_traffic_gridlock": {"coverage_hours": 2, "payout_tier": "partial"},
    # Severe gridlock during Pongal/Diwali/New Year

    "flood_road_closure":        {"coverage_hours": 6, "payout_tier": "full"},
    # Roads submerged — delivery impossible

    "none":          {"coverage_hours": 0, "payout_tier": "none"},
}


# ── Helper: zone income estimate for weekly premium calculation ───────────────
def get_zone_weekly_income(zone_key: str) -> float:
    """
    Estimate weekly income from zone food delivery profile.
    Used by payout_calculation_service as fallback when no DB earnings exist.
    Assumes 6 working days, 8% commission per order value.
    """
    profile = FOOD_DELIVERY_ZONE_PROFILE.get(zone_key, FOOD_DELIVERY_ZONE_PROFILE["default"])
    daily   = profile["avg_daily_orders"] * profile["avg_order_value"] * 0.08  # 8% commission
    return round(daily * 6, 2)  # 6-day working week


# ══════════════════════════════════════════════════════════════════════════════
class MLRiskModel:
    """
    Loads and serves the three trained scikit-learn models.
    Thread-safe: models are loaded once at __init__ and never mutated.
    """

    def __init__(self) -> None:
        logger.info("[MLRiskModel] Loading trained models...")
        try:
            self._risk_model    = joblib.load(_RISK_MODEL_PATH)
            self._delay_model   = joblib.load(_DELAY_MODEL_PATH)
            self._trigger_model = joblib.load(_TRIGGER_MODEL_PATH)
            with open(_METADATA_PATH) as f:
                self._metadata = json.load(f)
            self._feature_names = self._metadata["feature_names"]
            logger.info(
                f"[MLRiskModel] Loaded — "
                f"features={len(self._feature_names)} "
                f"trained_at={self._metadata.get('trained_at', 'unknown')}"
            )
        except FileNotFoundError as exc:
            raise RuntimeError(
                f"[MLRiskModel] Model files not found: {exc}\n"
                "Run python train_model.py first."
            ) from exc

    # ──────────────────────────────────────────────────────────────────────────
    # PRIMARY PREDICTION INTERFACE
    # ──────────────────────────────────────────────────────────────────────────

    def predict(
        self,
        rain_mm_per_hr:     float,
        temperature_c:      float,
        aqi:                int,
        wind_kmh:           float,
        visibility_m:       float,
        zone_flood_risk:    float,
        congestion:         int | str,
        traffic_delay_min:  int,
        road_closure:       int,
        driver_speed:       float,
        hist_avg_speed:     float,
        distance_remaining: float,
        hour:               int,
        weekday:            int,
        month:              int,
        db:              Optional[Session] = None,
        user_id:         Optional[int]     = None,
        driver_id:       Optional[str]     = None,
        driver_location: str               = "default",
    ) -> dict:
        now = datetime.utcnow()

        # ── Encode congestion string if needed ────────────────────────────────
        if isinstance(congestion, str):
            congestion = CONGESTION_MAP.get(congestion.lower(), 1)

        # ── Derived temporal features ─────────────────────────────────────────
        is_weekend = int(weekday >= 5)
        is_rush    = int((7 <= hour <= 10) or (12 <= hour <= 14) or (17 <= hour <= 20))

        # ── Speed deviation ───────────────────────────────────────────────────
        speed_deviation = abs(driver_speed - hist_avg_speed) / (hist_avg_speed + 1e-6)

        # ── Engineered interaction features ───────────────────────────────────
        rain_x_zone     = rain_mm_per_hr * zone_flood_risk
        heat_x_aqi      = (temperature_c - 28) * (aqi / 100)
        congestion_rush = congestion * is_rush
        speed_zone      = driver_speed * (1 - zone_flood_risk)

        # ── Build feature vector ──────────────────────────────────────────────
        base_features = {
            "rain_mm_per_hr":     rain_mm_per_hr,
            "temperature_c":      temperature_c,
            "aqi":                aqi,
            "wind_kmh":           wind_kmh,
            "visibility_m":       visibility_m,
            "zone_flood_risk":    zone_flood_risk,
            "congestion":         congestion,
            "traffic_delay_min":  traffic_delay_min,
            "road_closure":       road_closure,
            "driver_speed":       driver_speed,
            "speed_deviation":    round(speed_deviation, 4),
            "distance_remaining": distance_remaining,
            "hour":               hour,
            "weekday":            weekday,
            "month":              month,
            "is_weekend":         is_weekend,
            "is_rush_hour":       is_rush,
            "rain_x_zone":        rain_x_zone,
            "heat_x_aqi":         heat_x_aqi,
            "congestion_rush":    congestion_rush,
            "speed_zone":         speed_zone,
        }

        import pandas as pd
        X = pd.DataFrame(
            [[base_features[f] for f in self._feature_names]],
            columns=self._feature_names,
        )

        # ── Model inference ───────────────────────────────────────────────────
        risk_score      = float(np.clip(self._risk_model.predict(X)[0], 0, 100))
        delay_level_int = int(self._delay_model.predict(X)[0])
        trigger_proba   = float(self._trigger_model.predict_proba(X)[0, 1])
        trigger_fired   = trigger_proba >= 0.50

        delay_level = LEVEL_LABELS.get(delay_level_int, "low")
        risk_score  = round(risk_score, 2)
        confidence  = self._compute_confidence(
            rain_mm_per_hr, wind_kmh, temperature_c, congestion, driver_speed
        )

        # ── Rule-based parametric flags ───────────────────────────────────────
        flags, trigger_type = self._parametric_flags(
            rain_mm_per_hr, temperature_c, aqi, wind_kmh, visibility_m, road_closure,
        )

        rule_trigger  = any("PARAMETRIC_TRIGGER" in f or "COVERAGE_TRIGGER" in f for f in flags)
        final_trigger = trigger_fired and (rule_trigger or trigger_proba >= 0.80)

        # ── Parametric trigger output ─────────────────────────────────────────
        t_config     = TRIGGER_CONFIG.get(trigger_type or "none", TRIGGER_CONFIG["none"])
        coverage_hrs = t_config["coverage_hours"]
        payout_tier  = t_config["payout_tier"]

        # Zone bonus for high-risk areas
        if final_trigger and zone_flood_risk >= 0.80:
            coverage_hrs = min(8, coverage_hrs + 2)

        parametric = {
            "triggered":           final_trigger,
            "trigger_type":        trigger_type if final_trigger else None,
            "payout_tier":         payout_tier  if final_trigger else "none",
            "coverage_hours":      coverage_hrs if final_trigger else 0,
            "trigger_reason":      flags,
            "trigger_probability": round(trigger_proba, 4),
            "auto_claim_eligible": final_trigger and risk_score >= 60,
        }

        extra_minutes = self._estimate_extra_minutes(risk_score, distance_remaining)

        # ── Food delivery zone context ────────────────────────────────────────
        zone_profile = FOOD_DELIVERY_ZONE_PROFILE.get(
            driver_location.lower(), FOOD_DELIVERY_ZONE_PROFILE["default"]
        )

        result = {
            "delay_detected":     risk_score >= 40,
            "delay_level":        delay_level,
            "risk_score":         risk_score,
            "confidence":         round(confidence, 2),
            "extra_minutes":      extra_minutes,
            "parametric_trigger": parametric,
            "ml_scores": {
                "risk_score_raw":      risk_score,
                "delay_level_int":     delay_level_int,
                "trigger_probability": round(trigger_proba, 4),
                "model_confidence":    round(confidence, 2),
            },
            "feature_values": {
                "rain_mm_per_hr":  rain_mm_per_hr,
                "temperature_c":   temperature_c,
                "aqi":             aqi,
                "zone_flood_risk": zone_flood_risk,
                "congestion":      congestion,
                "driver_speed":    driver_speed,
                "speed_deviation": round(speed_deviation, 3),
                "month":           month,
            },
            # ── Food delivery context added to every prediction ───────────────
            "food_delivery_context": {
                "zone":               driver_location,
                "restaurant_density": zone_profile["restaurant_density"],
                "avg_order_value":    zone_profile["avg_order_value"],
                "avg_daily_orders":   zone_profile["avg_daily_orders"],
                "est_daily_income":   round(
                    zone_profile["avg_daily_orders"] * zone_profile["avg_order_value"] * 0.08, 2
                ),
            },
            "flags":         flags,
            "zone":          driver_location,
            "prediction_ts": now.isoformat(),
        }

        if db and user_id:
            self._persist(db, user_id, driver_id, result, base_features)

        logger.debug(
            f"[MLRiskModel] uid={user_id} score={risk_score} "
            f"level={delay_level} trigger={final_trigger}({trigger_proba:.2f}) flags={flags}"
        )
        return result

    # ──────────────────────────────────────────────────────────────────────────
    # CONVENIENCE: predict from zone key directly
    # ──────────────────────────────────────────────────────────────────────────

    def predict_for_zone(
        self,
        zone_key:           str,
        traffic:            str   = "moderate",
        driver_speed:       float = 15.0,
        distance_remaining: float = 3.0,
        db:                 Optional[Session] = None,
        user_id:            Optional[int]     = None,
        driver_id:          Optional[str]     = None,
    ) -> dict:
        """
        Build weather from zone risk and run prediction.
        No weather API needed — zone key is all that's required.
        """
        zone_risk = ZONE_RISK.get(zone_key, ZONE_RISK["default"])
        weather   = _zone_weather(zone_risk)
        return self.predict_from_dicts(
            weather            = weather,
            traffic            = {
                "congestion_level": traffic,
                "delay":            CONGESTION_DELAY.get(traffic, 15),
                "road_closure":     False,
            },
            driver_speed       = driver_speed,
            distance_remaining = distance_remaining,
            zone_flood_risk    = zone_risk,
            hist_avg_speed     = 22.0,
            driver_location    = zone_key,
            db=db, user_id=user_id, driver_id=driver_id,
        )

    # ──────────────────────────────────────────────────────────────────────────
    # CONVENIENCE: predict from weather + traffic dicts
    # ──────────────────────────────────────────────────────────────────────────

    def predict_from_dicts(
        self,
        weather:            dict,
        traffic:            dict,
        driver_speed:       float,
        distance_remaining: float,
        zone_flood_risk:    float = 0.50,
        hist_avg_speed:     float = 22.0,
        driver_location:    str   = "default",
        db:                 Optional[Session] = None,
        user_id:            Optional[int]     = None,
        driver_id:          Optional[str]     = None,
    ) -> dict:
        """
        Accepts weather and traffic dicts directly.
        weather must have: rain_mm_per_hr, temperature_c, aqi, wind_kmh, visibility_m
        traffic must have: congestion_level, delay, road_closure
        """
        now = datetime.utcnow()
        return self.predict(
            rain_mm_per_hr     = weather.get("rain_mm_per_hr", 0),
            temperature_c      = weather.get("temperature_c",  28),
            aqi                = weather.get("aqi",            80),
            wind_kmh           = weather.get("wind_kmh",       0),
            visibility_m       = weather.get("visibility_m",   5_000),
            zone_flood_risk    = zone_flood_risk,
            congestion         = traffic.get("congestion_level", "moderate"),
            traffic_delay_min  = traffic.get("delay",           0),
            road_closure       = int(traffic.get("road_closure", False)),
            driver_speed       = driver_speed,
            hist_avg_speed     = hist_avg_speed,
            distance_remaining = distance_remaining,
            hour               = now.hour,
            weekday            = now.weekday(),
            month              = now.month,
            db=db, user_id=user_id, driver_id=driver_id,
            driver_location    = driver_location,
        )

    # ──────────────────────────────────────────────────────────────────────────
    # MODEL METADATA
    # ──────────────────────────────────────────────────────────────────────────

    def model_info(self) -> dict:
        return {
            "models":                   self._metadata.get("models", {}),
            "trained_at":               self._metadata.get("trained_at"),
            "n_features":               self._metadata.get("n_features"),
            "feature_names":            self._feature_names,
            "thresholds":               THRESHOLDS,
            "persona":                  "Food Delivery Partners — Zomato/Swiggy — Chennai",
            "food_delivery_triggers":   list(TRIGGER_CONFIG.keys()),
        }

    # ──────────────────────────────────────────────────────────────────────────
    # PRIVATE HELPERS
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _parametric_flags(
        rain: float, temp: float, aqi: int,
        wind: float, vis: float, road_closure: int,
    ) -> tuple[list[str], Optional[str]]:
        flags: list[str] = []
        trigger_type: Optional[str] = None

        if rain >= THRESHOLDS["rain_extreme_mm"]:
            flags.append("EXTREME_RAINFALL_PARAMETRIC_TRIGGER")
            trigger_type = "extreme_rain"
        elif rain >= THRESHOLDS["rain_heavy_mm"]:
            flags.append("HEAVY_RAINFALL_COVERAGE_TRIGGER")
            trigger_type = "heavy_rain"
        elif rain >= THRESHOLDS["rain_moderate_mm"]:
            flags.append("MODERATE_RAIN_ADVISORY")

        if temp >= THRESHOLDS["temp_extreme_c"]:
            flags.append("EXTREME_HEAT_PARAMETRIC_TRIGGER")
            if not trigger_type: trigger_type = "severe_heat"

        if aqi >= THRESHOLDS["aqi_severe"]:
            flags.append("SEVERE_AQI_COVERAGE_TRIGGER")
            if not trigger_type: trigger_type = "severe_aqi"

        if wind >= THRESHOLDS["wind_high_kmh"]:
            flags.append("HIGH_WIND_WARNING")

        if vis <= THRESHOLDS["visibility_low_m"]:
            flags.append("LOW_VISIBILITY_WARNING")

        if road_closure:
            flags.append("ROAD_CLOSURE_SOCIAL_TRIGGER")
            if not trigger_type: trigger_type = "road_closure"

        return flags, trigger_type

    @staticmethod
    def _compute_confidence(
        rain: float, wind: float,
        temp: float, congestion: int, speed: float,
    ) -> float:
        score = 0.70
        if rain > 0:                score += 0.06
        if wind > 0:                score += 0.04
        if 20 <= temp <= 45:        score += 0.04
        if congestion in (0,1,2,3): score += 0.06
        if 0 < speed < 100:         score += 0.05
        return min(1.0, score)

    @staticmethod
    def _estimate_extra_minutes(score: float, distance: float) -> int:
        if score < 40: return 0
        return int((score - 40) * 0.5) + min(20, int(distance * 1.5))

    @staticmethod
    def _persist(
        db:        Session,
        user_id:   int,
        driver_id: Optional[str],
        result:    dict,
        features:  dict,
    ) -> None:
        try:
            from app.models.payout_model import PredictionHistory
            parametric = result.get("parametric_trigger", {})
            record = PredictionHistory(
                user_id             = user_id,
                driver_ref          = driver_id,
                risk_score          = result["risk_score"],
                delay_level         = result["delay_level"],
                confidence          = result["confidence"],
                extra_minutes       = result["extra_minutes"],
                trigger_type        = parametric.get("trigger_type"),
                trigger_fired       = parametric.get("triggered", False),
                auto_claim_eligible = parametric.get("auto_claim_eligible", False),
                location            = result.get("zone"),
                traffic_level       = str(features.get("congestion", "")),
                rain_mm_per_hr      = features.get("rain_mm_per_hr", 0),
                temperature_c       = features.get("temperature_c",  0),
                aqi                 = int(features.get("aqi", 0)),
                driver_speed        = features.get("driver_speed",   0),
                flags               = result.get("flags", []),
                risk_breakdown      = result.get("ml_scores", {}),
            )
            db.add(record)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"[MLRiskModel] DB persist failed: {exc}")


# ─── Singleton ────────────────────────────────────────────────────────────────
_model: Optional[MLRiskModel] = None


def get_model() -> MLRiskModel:
    """Returns the singleton, loading it on first call."""
    global _model
    if _model is None:
        _model = MLRiskModel()
    return _model


# ─── Drop-in replacement for ai_delay_predictor.predict_delay() ──────────────
def predict_delay(
    traffic:              str | dict,
    weather:              dict,
    driver_speed:         float,
    distance_remaining:   float,
    db:                   Optional[Session] = None,
    driver_location:      str               = "default",
    user_id:              Optional[int]     = None,
    driver_id:            Optional[str]     = None,
    historical_avg_speed: Optional[float]   = None,
    zone_flood_risk:      float             = 0.50,
) -> dict:
    """
    Drop-in replacement for ai_delay_predictor.predict_delay().
    Accepts identical arguments — uses ML models instead of weighted rules.
    If weather is not a dict (e.g. a string), builds it from zone_flood_risk.
    """
    if not isinstance(weather, dict):
        weather = _zone_weather(zone_flood_risk)

    if isinstance(traffic, str):
        traffic = {
            "congestion_level": traffic,
            "delay":            CONGESTION_DELAY.get(traffic, 15),
            "road_closure":     False,
        }

    return get_model().predict_from_dicts(
        weather            = weather,
        traffic            = traffic,
        driver_speed       = driver_speed,
        distance_remaining = distance_remaining,
        zone_flood_risk    = zone_flood_risk,
        hist_avg_speed     = historical_avg_speed or 22.0,
        driver_location    = driver_location,
        db                 = db,
        user_id            = user_id,
        driver_id          = driver_id,
    )