"""
AI-Powered Delay & Risk Prediction Engine
Guidewire DEVTrails 2026 — GigShield Parametric Insurance Platform

DB integration: every prediction is persisted to `prediction_history`
so driver risk profiles survive server restarts.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.payout_model import PredictionHistory

logger = logging.getLogger(__name__)


# ─── Chennai Hyperlocal Flood-Risk Zones ──────────────────────────────────────
CHENNAI_ZONE_RISK: dict[str, float] = {
    "velachery": 0.90, "adyar": 0.85, "porur": 0.75,
    "tambaram":  0.70, "chromepet": 0.60, "kodambakkam": 0.65,
    "perambur":  0.55, "t_nagar": 0.50, "anna_nagar": 0.40,
    "default":   0.50,
}

# ─── Seasonal Risk Multipliers (NE Monsoon peaks Oct–Nov) ─────────────────────
SEASONAL_MULTIPLIER: dict[int, float] = {
    1: 1.00, 2: 1.00, 3: 1.00, 4: 1.20, 5: 1.40,
    6: 1.30, 7: 1.20, 8: 1.20, 9: 1.30,
    10: 1.80, 11: 1.90, 12: 1.50,
}

# ─── Rush-Hour Windows ────────────────────────────────────────────────────────
RUSH_HOURS = [(7, 30, 10, 30), (12, 0, 14, 0), (17, 0, 20, 30)]

# ─── Parametric Weather Thresholds ────────────────────────────────────────────
THRESHOLDS = {
    "rain_extreme_mm": 65, "rain_heavy_mm": 35, "rain_moderate_mm": 15,
    "wind_high_kmh": 40,   "temp_extreme_c": 42,
    "aqi_severe": 300,     "visibility_low_m": 200,
}


# ══════════════════════════════════════════════════════════════════════════════
class AIDelayPredictor:
    """
    5-factor weighted ensemble risk engine.
    All predictions are persisted to DB via an injected SQLAlchemy Session.
    """

    WEIGHTS = {
        "traffic": 0.25, "weather": 0.35, "zone_risk": 0.20,
        "temporal": 0.10, "driver_behavior": 0.10,
    }

    # ──────────────────────────────────────────────────────────────────────────
    # PUBLIC API
    # ──────────────────────────────────────────────────────────────────────────

    def predict_delay(
        self,
        traffic: str,
        weather: dict,
        driver_speed: float,
        distance_remaining: float,
        db: Optional[Session] = None,
        driver_location: str = "default",
        user_id: Optional[int] = None,
        driver_id: Optional[str] = None,
        historical_avg_speed: Optional[float] = None,
    ) -> dict:
        now    = datetime.utcnow()
        month  = now.month
        hour   = now.hour
        minute = now.minute

        # ── Score each dimension ──────────────────────────────────────────────
        t_score          = self._score_traffic(traffic)
        w_score, w_flags = self._score_weather(weather)
        zone_key         = driver_location.lower().replace(" ", "_")
        zone_risk        = CHENNAI_ZONE_RISK.get(zone_key, CHENNAI_ZONE_RISK["default"])
        z_score          = zone_risk * 100
        temp_score       = self._score_temporal(hour, minute, now.weekday())
        b_score, b_flags = self._score_behaviour(
            driver_speed, distance_remaining, historical_avg_speed
        )

        # ── Weighted ensemble + seasonal multiplier ───────────────────────────
        raw = (
            t_score    * self.WEIGHTS["traffic"]
            + w_score  * self.WEIGHTS["weather"]
            + z_score  * self.WEIGHTS["zone_risk"]
            + temp_score * self.WEIGHTS["temporal"]
            + b_score  * self.WEIGHTS["driver_behavior"]
        )
        seasonal    = SEASONAL_MULTIPLIER.get(month, 1.0)
        final_score = round(min(100.0, raw * seasonal), 2)

        all_flags     = w_flags + b_flags
        delay_level   = self._classify_level(final_score)
        extra_minutes = self._estimate_extra_minutes(final_score, distance_remaining)
        parametric    = self._evaluate_parametric_trigger(
            final_score, weather, all_flags, zone_risk
        )
        confidence    = self._confidence(weather, traffic, driver_speed)
        breakdown = {
            "traffic_component":         round(t_score    * self.WEIGHTS["traffic"],         2),
            "weather_component":         round(w_score    * self.WEIGHTS["weather"],         2),
            "zone_risk_component":       round(z_score    * self.WEIGHTS["zone_risk"],       2),
            "temporal_component":        round(temp_score * self.WEIGHTS["temporal"],        2),
            "driver_behavior_component": round(b_score    * self.WEIGHTS["driver_behavior"], 2),
            "seasonal_multiplier":       seasonal,
        }

        result = {
            "delay_detected":     final_score >= 40,
            "delay_level":        delay_level,
            "risk_score":         final_score,
            "confidence":         round(confidence, 2),
            "extra_minutes":      extra_minutes,
            "parametric_trigger": parametric,
            "risk_breakdown":     breakdown,
            "flags":              all_flags,
            "zone":               driver_location,
            "prediction_ts":      now.isoformat(),
        }

        # ── Persist to DB ─────────────────────────────────────────────────────
        if db:
            self._persist_prediction(
                db, user_id, driver_id, final_score, delay_level,
                confidence, extra_minutes, parametric, driver_location,
                traffic, weather, driver_speed, all_flags, breakdown,
            )

        logger.debug(
            f"[AIPredictor] uid={user_id} score={final_score} "
            f"level={delay_level} flags={all_flags}"
        )
        return result

    def get_driver_risk_profile(
        self,
        db: Session,
        user_id: Optional[int] = None,
        driver_ref: Optional[str] = None,
    ) -> dict:
        """
        Build driver risk profile from DB — survives server restarts.
        Queries prediction_history table.
        """
        query = db.query(PredictionHistory)
        if user_id:
            query = query.filter(PredictionHistory.user_id == user_id)
        elif driver_ref:
            query = query.filter(PredictionHistory.driver_ref == driver_ref)
        else:
            return {"profile": "no_identifier_provided", "risk_tier": "medium"}

        records = query.all()
        if not records:
            return {
                "user_id":   user_id,
                "profile":   "insufficient_data",
                "risk_tier": "medium",
            }

        avg_score = db.query(
            func.avg(PredictionHistory.risk_score)
        ).filter(
            PredictionHistory.user_id == user_id
        ).scalar() or 0.0

        trigger_count = db.query(
            func.count(PredictionHistory.id)
        ).filter(
            PredictionHistory.user_id == user_id,
            PredictionHistory.trigger_fired == True,
        ).scalar() or 0

        # Common triggers from the last 30 records
        recent       = records[-30:]
        trigger_types = list({
            r.trigger_type for r in recent
            if r.trigger_type
        })

        return {
            "user_id":            user_id,
            "average_risk_score": round(float(avg_score), 2),
            "total_predictions":  len(records),
            "total_triggers":     trigger_count,
            "risk_tier": (
                "high" if avg_score > 65
                else "medium" if avg_score > 40
                else "low"
            ),
            "common_triggers": trigger_types,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # FEATURE SCORERS
    # ──────────────────────────────────────────────────────────────────────────

    def _score_traffic(self, traffic: str) -> float:
        return {"low": 10, "moderate": 40, "heavy": 70, "gridlock": 95}.get(
            traffic.lower(), 30
        )

    def _score_weather(self, weather: dict) -> tuple[float, list[str]]:
        score = 0.0
        flags: list[str] = []
        rain       = weather.get("rain_mm_per_hr", 0)
        wind       = weather.get("wind_kmh", 0)
        temp       = weather.get("temperature_c", 28)
        aqi        = weather.get("aqi", 50)
        visibility = weather.get("visibility_m", 10_000)
        condition  = weather.get("condition", "clear").lower()

        if rain >= THRESHOLDS["rain_extreme_mm"]:
            score += 95; flags.append("EXTREME_RAINFALL_PARAMETRIC_TRIGGER")
        elif rain >= THRESHOLDS["rain_heavy_mm"]:
            score += 75; flags.append("HEAVY_RAINFALL_COVERAGE_TRIGGER")
        elif rain >= THRESHOLDS["rain_moderate_mm"]:
            score += 50; flags.append("MODERATE_RAIN_ADVISORY")
        elif rain > 5:
            score += 25

        if wind >= THRESHOLDS["wind_high_kmh"]:
            score = min(100, score + 20); flags.append("HIGH_WIND_WARNING")
        if temp >= THRESHOLDS["temp_extreme_c"]:
            score = min(100, score + 35); flags.append("EXTREME_HEAT_PARAMETRIC_TRIGGER")
        elif temp >= 38:
            score = min(100, score + 15)
        if aqi >= THRESHOLDS["aqi_severe"]:
            score = min(100, score + 30); flags.append("SEVERE_AQI_COVERAGE_TRIGGER")
        elif aqi >= 200:
            score = min(100, score + 15)
        if visibility <= THRESHOLDS["visibility_low_m"]:
            score = min(100, score + 20); flags.append("LOW_VISIBILITY_WARNING")
        if condition in ("cyclone", "thunderstorm"):
            score = min(100, score + 40)
            flags.append(f"EXTREME_CONDITION_{condition.upper()}")

        return score, flags

    def _score_temporal(self, hour: int, minute: int, weekday: int) -> float:
        score = 0.0
        t = hour + minute / 60
        for (sh, sm, eh, em) in RUSH_HOURS:
            if (sh + sm / 60) <= t <= (eh + em / 60):
                score += 40; break
        if weekday >= 5: score *= 0.70
        if hour >= 22 or hour <= 5: score += 20
        return min(100, score)

    def _score_behaviour(
        self, speed: float, distance: float, historical_avg: Optional[float]
    ) -> tuple[float, list[str]]:
        score = 0.0
        flags: list[str] = []
        if historical_avg and historical_avg > 0:
            if abs(speed - historical_avg) / historical_avg > 0.50:
                score += 30; flags.append("SPEED_ANOMALY_DETECTED")
        if speed < 5 and distance > 1:
            score += 40; flags.append("VEHICLE_POSSIBLY_STOPPED")
        elif speed < 15:
            score += 20
        score += 15 if distance > 10 else 8 if distance > 5 else 0
        return min(100, score), flags

    def _evaluate_parametric_trigger(
        self, score: float, weather: dict, flags: list[str], zone_risk: float
    ) -> dict:
        triggered    = False
        trigger_type = None
        coverage_hrs = 0
        payout_tier  = "none"
        reasons: list[str] = []

        rain = weather.get("rain_mm_per_hr", 0)
        temp = weather.get("temperature_c", 28)
        aqi  = weather.get("aqi", 50)

        if "EXTREME_RAINFALL_PARAMETRIC_TRIGGER" in flags:
            triggered = True; trigger_type = "extreme_rain"
            coverage_hrs = 4; payout_tier = "full"
            reasons.append(f"Rain {rain}mm/hr >= {THRESHOLDS['rain_extreme_mm']}mm/hr")
        elif "HEAVY_RAINFALL_COVERAGE_TRIGGER" in flags:
            triggered = True; trigger_type = "heavy_rain"
            coverage_hrs = 2; payout_tier = "partial"
            reasons.append(f"Rain {rain}mm/hr >= {THRESHOLDS['rain_heavy_mm']}mm/hr")
        elif "EXTREME_HEAT_PARAMETRIC_TRIGGER" in flags:
            triggered = True; trigger_type = "severe_heat"
            coverage_hrs = 3; payout_tier = "partial"
            reasons.append(f"Temp {temp}C >= {THRESHOLDS['temp_extreme_c']}C")
        elif "SEVERE_AQI_COVERAGE_TRIGGER" in flags:
            triggered = True; trigger_type = "severe_aqi"
            coverage_hrs = 2; payout_tier = "partial"
            reasons.append(f"AQI {aqi} >= {THRESHOLDS['aqi_severe']}")

        if triggered and zone_risk >= 0.80:
            coverage_hrs = min(8, coverage_hrs + 2)
            reasons.append(f"High flood-zone bonus +2hrs (zone_risk={zone_risk})")

        return {
            "triggered":           triggered,
            "trigger_type":        trigger_type,
            "payout_tier":         payout_tier,
            "coverage_hours":      coverage_hrs,
            "trigger_reason":      reasons,
            "auto_claim_eligible": triggered and score >= 60,
        }

    @staticmethod
    def _classify_level(score: float) -> str:
        if score >= 80: return "critical"
        if score >= 60: return "high"
        if score >= 40: return "moderate"
        return "low"

    @staticmethod
    def _estimate_extra_minutes(score: float, distance: float) -> int:
        if score < 40: return 0
        return int((score - 40) * 0.5) + min(20, int(distance * 1.5))

    @staticmethod
    def _confidence(weather: dict, traffic: str, speed: float) -> float:
        score    = 0.50
        provided = sum(
            1 for k in ("rain_mm_per_hr", "wind_kmh", "temperature_c", "aqi", "visibility_m")
            if weather.get(k) is not None
        )
        score += provided * 0.08
        if traffic.lower() in ("low", "moderate", "heavy", "gridlock"): score += 0.10
        if 0 < speed < 120: score += 0.05
        return min(1.0, score)

    # ──────────────────────────────────────────────────────────────────────────
    # DB WRITE
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _persist_prediction(
        db: Session,
        user_id: Optional[int],
        driver_ref: Optional[str],
        risk_score: float,
        delay_level: str,
        confidence: float,
        extra_minutes: int,
        parametric: dict,
        location: str,
        traffic: str,
        weather: dict,
        speed: float,
        flags: list,
        breakdown: dict,
    ) -> None:
        try:
            record = PredictionHistory(
                user_id             = user_id,
                driver_ref          = driver_ref,
                risk_score          = risk_score,
                delay_level         = delay_level,
                confidence          = confidence,
                extra_minutes       = extra_minutes,
                trigger_type        = parametric.get("trigger_type"),
                trigger_fired       = parametric.get("triggered", False),
                auto_claim_eligible = parametric.get("auto_claim_eligible", False),
                location            = location,
                traffic_level       = traffic,
                rain_mm_per_hr      = weather.get("rain_mm_per_hr", 0),
                temperature_c       = weather.get("temperature_c", 0),
                aqi                 = weather.get("aqi", 0),
                driver_speed        = speed,
                flags               = flags,
                risk_breakdown      = breakdown,
            )
            db.add(record)
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"[AIPredictor] Failed to persist prediction: {exc}")


# ─── Module-level singleton ────────────────────────────────────────────────────
_predictor = AIDelayPredictor()


def predict_delay(
    traffic: str,
    weather: dict,
    driver_speed: float,
    distance_remaining: float,
    db: Optional[Session] = None,
    driver_location: str = "default",
    user_id: Optional[int] = None,
    driver_id: Optional[str] = None,
    historical_avg_speed: Optional[float] = None,
) -> dict:
    return _predictor.predict_delay(
        traffic=traffic, weather=weather,
        driver_speed=driver_speed, distance_remaining=distance_remaining,
        db=db, driver_location=driver_location, user_id=user_id,
        driver_id=driver_id, historical_avg_speed=historical_avg_speed,
    )


def get_driver_risk_profile(
    db: Session,
    user_id: Optional[int] = None,
    driver_ref: Optional[str] = None,
) -> dict:
    return _predictor.get_driver_risk_profile(
        db=db, user_id=user_id, driver_ref=driver_ref
    )