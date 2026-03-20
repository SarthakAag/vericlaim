"""
External Delay & Parametric Event Detection Service
Guidewire DEVTrails 2026 — GigShield Insurance Platform

DB integration:
  • Reads PolicyEnrollment   → checks active policy + weekly usage counters
  • Reads DeliveryEarnings   → gets rolling weekly_avg_income
  • Reads PredictionHistory  → deduplication check (replaces in-memory cache)
  • Writes nothing here — the payout engine owns all writes
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, date
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.services.traffic_service import get_traffic_data
from app.services.weather_service import get_weather_data
from app.services.ml_risk_model import predict_delay
from app.models.enrollment_model import PolicyEnrollment
from app.models.earnings_model import DeliveryEarnings
from app.models.payout_model import PredictionHistory

logger = logging.getLogger(__name__)


# ─── Severity ladder ──────────────────────────────────────────────────────────
SEVERITY_CODE = {
    "NONE": 0, "ADVISORY": 1, "MINOR": 2,
    "MODERATE": 3, "MAJOR": 4, "CRITICAL": 5,
}

# ─── Income loss rate per disruption type ─────────────────────────────────────
INCOME_LOSS_RATE: dict[str, float] = {
    "extreme_rain": 0.85, "heavy_rain": 0.60, "flood": 0.95,
    "cyclone": 1.00,      "curfew": 1.00,      "strike": 0.90,
    "severe_heat": 0.50,  "severe_aqi": 0.40,  "road_closure": 0.70,
    "low_visibility": 0.35, "operational_delay": 0.30, "none": 0.00,
}

SEVERITY_LOSS_FRACTION: dict[str, float] = {
    "CRITICAL": 1.00, "MAJOR": 0.85, "MODERATE": 0.65,
    "MINOR": 0.40,    "ADVISORY": 0.20, "NONE": 0.00,
}

# Dedup window: ignore same trigger from same driver within 5 min
_DEDUP_MINUTES = 5


# ══════════════════════════════════════════════════════════════════════════════
class DelayDetectionService:

    def detect_external_delay(
        self,
        driver_location: str,
        destination: str,
        db: Session,
        user_id: Optional[int] = None,
        driver_id: Optional[str] = None,
        driver_speed: float = 20.0,
        distance_remaining: float = 3.0,
        historical_avg_speed: Optional[float] = None,
    ) -> dict:
        """
        Detect external disruptions → produce structured insurance event report.

        DB reads
        --------
        • PolicyEnrollment  → active policy tier + weekly usage counters
        • DeliveryEarnings  → 4-week rolling weekly_avg_income
        • PredictionHistory → deduplication check
        """
        now = datetime.utcnow()

        # ── DB lookups ────────────────────────────────────────────────────────
        enrollment        = self._get_active_enrollment(db, user_id)
        weekly_avg_income = self._get_weekly_avg_income(db, user_id)

        # ── Deduplication check ───────────────────────────────────────────────
        if self._is_duplicate_event(db, user_id, driver_location, now):
            return {
                "status":  "DUPLICATE_EVENT_SKIPPED",
                "message": f"Same location triggered within {_DEDUP_MINUTES} min",
                "location": driver_location,
                "user_id":  user_id,
            }

        # ── External data (graceful fallback) ─────────────────────────────────
        traffic = self._safe_get_traffic(driver_location, destination)
        weather = self._safe_get_weather(driver_location)

        # ── AI prediction (with DB write of prediction history) ───────────────
        prediction = predict_delay(
            traffic=traffic.get("congestion_level", "moderate"),
            weather=weather,
            driver_speed=driver_speed,
            distance_remaining=distance_remaining,
            db=db,
            driver_location=driver_location,
            user_id=user_id,
            driver_id=driver_id,
            historical_avg_speed=historical_avg_speed,
        )

        # ── Classify disruption + severity ───────────────────────────────────
        event         = self._classify_event(prediction, traffic, weather)
        delay_minutes = self._total_delay(prediction, traffic, weather)
        income_loss   = self._income_loss(
            event["disruption_type"], event["severity_level"],
            delay_minutes, weekly_avg_income,
        )

        # ── 5-check fraud assessment ──────────────────────────────────────────
        fraud = self._fraud_assessment(
            db, user_id, driver_location, driver_speed,
            prediction, weather, traffic, now,
        )

        # ── Assemble report ───────────────────────────────────────────────────
        parametric = prediction.get("parametric_trigger", {})
        report = {
            "event_id":          self._make_event_id(driver_id or str(user_id), now),
            "timestamp":         now.isoformat(),
            "user_id":           user_id,
            "driver_id":         driver_id,
            "location":          driver_location,
            "destination":       destination,
            "disruption_type":   event["disruption_type"],
            "severity_level":    event["severity_level"],
            "severity_code":     event["severity_code"],
            "delay_minutes":     delay_minutes,
            "income_loss_estimate": income_loss,
            "weekly_avg_income": weekly_avg_income,
            "parametric_trigger": parametric,
            "fraud_assessment":  fraud,
            "risk_score":        prediction.get("risk_score", 0),
            "confidence":        prediction.get("confidence", 0),
            "flags":             prediction.get("flags", []) + fraud.get("flags", []),
            "enrollment_context": {
                "policy_tier":              enrollment.policy_tier if enrollment else None,
                "claims_this_week":         enrollment.claims_this_week if enrollment else 0,
                "coverage_hours_remaining": (
                    max(0,
                        (enrollment.policy_id and 16 or 8)  # fallback
                        - (enrollment.coverage_hours_used_this_week if enrollment else 0)
                    )
                ),
                "payout_total_this_week":   enrollment.payout_total_this_week if enrollment else 0,
            },
            "raw_data":  {"traffic": traffic, "weather": weather},
            "recommended_action": self._recommended_action(event, fraud, parametric),
            "auto_claim_eligible": (
                parametric.get("auto_claim_eligible", False)
                and fraud.get("fraud_risk") == "low"
                and enrollment is not None
                and enrollment.status == "active"
            ),
        }

        logger.info(
            f"[DelayDetection] uid={user_id} type={event['disruption_type']} "
            f"severity={event['severity_level']} score={prediction.get('risk_score')} "
            f"auto_claim={report['auto_claim_eligible']} fraud={fraud.get('fraud_risk')}"
        )
        return report

    # ──────────────────────────────────────────────────────────────────────────
    # DB READS
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _get_active_enrollment(
        db: Session, user_id: Optional[int]
    ) -> Optional[PolicyEnrollment]:
        if not user_id:
            return None
        return (
            db.query(PolicyEnrollment)
            .filter(
                PolicyEnrollment.user_id == user_id,
                PolicyEnrollment.status  == "active",
            )
            .order_by(PolicyEnrollment.enrolled_at.desc())
            .first()
        )

    @staticmethod
    def _get_weekly_avg_income(
        db: Session, user_id: Optional[int]
    ) -> float:
        """4-week rolling average weekly income from delivery_earnings."""
        if not user_id:
            return 4_000.0   # safe default

        four_weeks_ago = date.today() - timedelta(weeks=4)
        result = (
            db.query(func.avg(DeliveryEarnings.total_earnings))
            .filter(
                DeliveryEarnings.user_id    == user_id,
                DeliveryEarnings.week_start >= four_weeks_ago,
            )
            .scalar()
        )
        return float(result) if result else 4_000.0

    @staticmethod
    def _is_duplicate_event(
        db: Session,
        user_id: Optional[int],
        location: str,
        now: datetime,
    ) -> bool:
        """True if driver already had a trigger at this location within 5 min."""
        if not user_id:
            return False
        cutoff = now - timedelta(minutes=_DEDUP_MINUTES)
        existing = (
            db.query(PredictionHistory)
            .filter(
                PredictionHistory.user_id       == user_id,
                PredictionHistory.location      == location,
                PredictionHistory.trigger_fired == True,
                PredictionHistory.predicted_at  >= cutoff,
            )
            .first()
        )
        return existing is not None

    # ──────────────────────────────────────────────────────────────────────────
    # EXTERNAL DATA FETCHERS
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _safe_get_traffic(origin: str, destination: str) -> dict:
        try:
            data = get_traffic_data(origin, destination)
            return {
                "congestion_level": data.get("congestion_level", "moderate"),
                "delay":            data.get("delay", 0),
                "road_closure":     data.get("road_closure", False),
                "incident_type":    data.get("incident_type"),
            }
        except Exception as exc:
            logger.warning(f"[TrafficService] fallback: {exc}")
            return {"congestion_level": "unknown", "delay": 0,
                    "road_closure": False, "incident_type": None}

    @staticmethod
    def _safe_get_weather(location: str) -> dict:
        try:
            data = get_weather_data(location)
            return {
                "condition":      data.get("condition", "clear"),
                "rain_mm_per_hr": data.get("rain_mm_per_hr", data.get("rain_intensity_mm", 0)),
                "wind_kmh":       data.get("wind_kmh", 0),
                "temperature_c":  data.get("temperature_c", 30),
                "aqi":            data.get("aqi", 80),
                "visibility_m":   data.get("visibility_m", 5_000),
                "humidity":       data.get("humidity", 70),
            }
        except Exception as exc:
            logger.warning(f"[WeatherService] fallback: {exc}")
            return {"condition": "unknown", "rain_mm_per_hr": 0,
                    "wind_kmh": 0, "temperature_c": 30,
                    "aqi": 80, "visibility_m": 5_000, "humidity": 70}

    # ──────────────────────────────────────────────────────────────────────────
    # CLASSIFICATION, DELAY, INCOME LOSS
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _classify_event(prediction: dict, traffic: dict, weather: dict) -> dict:
        parametric      = prediction.get("parametric_trigger", {})
        score           = prediction.get("risk_score", 0)
        disruption_type = parametric.get("trigger_type") or "operational_delay"

        if traffic.get("road_closure"):
            disruption_type = "road_closure"
        incident = traffic.get("incident_type")
        if incident in ("curfew", "strike", "protest"):
            disruption_type = incident

        if   score >= 85: severity = "CRITICAL"
        elif score >= 70: severity = "MAJOR"
        elif score >= 55: severity = "MODERATE"
        elif score >= 40: severity = "MINOR"
        elif score >= 20: severity = "ADVISORY"
        else:             severity = "NONE"

        return {
            "disruption_type": disruption_type,
            "severity_level":  severity,
            "severity_code":   SEVERITY_CODE[severity],
        }

    @staticmethod
    def _total_delay(prediction: dict, traffic: dict, weather: dict) -> int:
        base    = prediction.get("extra_minutes", 0)
        traffic_d = traffic.get("delay", 0)
        rain    = weather.get("rain_mm_per_hr", 0)
        weather_d = 60 if rain >= 65 else 30 if rain >= 35 else 15 if rain >= 15 else 0
        return base + traffic_d + weather_d

    @staticmethod
    def _income_loss(
        disruption_type: str, severity_level: str,
        delay_minutes: int, weekly_avg_income: float
    ) -> dict:
        hourly_rate  = weekly_avg_income / (6 * 10)
        loss_rate    = INCOME_LOSS_RATE.get(disruption_type, 0.30)
        severity_pct = SEVERITY_LOSS_FRACTION.get(severity_level, 0.50)
        delay_hours  = delay_minutes / 60
        estimated    = round(hourly_rate * loss_rate * severity_pct * delay_hours, 2)
        return {
            "amount_inr":        estimated,
            "delay_hours":       round(delay_hours, 2),
            "hourly_rate_inr":   round(hourly_rate, 2),
            "loss_rate_applied": loss_rate,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # FRAUD ASSESSMENT  (5 checks — 2 now use DB)
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _fraud_assessment(
        db: Session,
        user_id: Optional[int],
        location: str,
        speed: float,
        prediction: dict,
        weather: dict,
        traffic: dict,
        now: datetime,
    ) -> dict:
        fraud_score = 0
        flags: list[str] = []
        rain = weather.get("rain_mm_per_hr", 0)
        risk = prediction.get("risk_score", 0)

        # Check 1 — Speed/weather mismatch
        if rain > 35 and speed > 35:
            fraud_score += 30; flags.append("FRAUD_SPEED_WEATHER_MISMATCH")

        # Check 2 — DB dedup: 3+ triggers in 24 hours  (velocity check)
        if user_id:
            cutoff_24h = now - timedelta(hours=24)
            recent_triggers = (
                db.query(func.count(PredictionHistory.id))
                .filter(
                    PredictionHistory.user_id       == user_id,
                    PredictionHistory.trigger_fired == True,
                    PredictionHistory.predicted_at  >= cutoff_24h,
                )
                .scalar() or 0
            )
            if recent_triggers >= 3:
                fraud_score += 25; flags.append("FRAUD_HIGH_CLAIM_VELOCITY_24H")

        # Check 3 — Borderline risk score (possible manipulation)
        if 57 <= risk <= 63:
            fraud_score += 10; flags.append("FRAUD_BORDERLINE_RISK_SCORE")

        # Check 4 — Traffic/claim inconsistency
        if (
            traffic.get("congestion_level") == "low"
            and prediction.get("delay_level") in ("high", "critical")
        ):
            fraud_score += 20; flags.append("FRAUD_TRAFFIC_CLAIM_INCONSISTENCY")

        # Check 5 — Weather data injection (sensor says clear, rain > 30)
        if weather.get("condition") == "clear" and rain > 30:
            fraud_score += 35; flags.append("FRAUD_WEATHER_DATA_INCONSISTENCY")

        risk_level = "high" if fraud_score >= 60 else "medium" if fraud_score >= 30 else "low"
        return {
            "fraud_score":            fraud_score,
            "fraud_risk":             risk_level,
            "flags":                  flags,
            "manual_review_required": fraud_score >= 30,
        }

    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _recommended_action(event: dict, fraud: dict, parametric: dict) -> str:
        if fraud.get("fraud_risk") == "high":   return "HOLD_FOR_MANUAL_REVIEW"
        if fraud.get("fraud_risk") == "medium": return "FLAG_FOR_SECONDARY_REVIEW"
        if parametric.get("auto_claim_eligible"): return "AUTO_PROCESS_CLAIM"
        if event.get("severity_code", 0) >= SEVERITY_CODE["MODERATE"]:
            return "NOTIFY_DRIVER_FILE_CLAIM"
        return "MONITOR_CONTINUE_DELIVERY"

    @staticmethod
    def _make_event_id(ref: str, ts: datetime) -> str:
        return f"EVT-{ref[:8].upper()}-{ts.strftime('%Y%m%d%H%M%S')}"


# ─── Singleton + backward-compatible entry point ──────────────────────────────
_service = DelayDetectionService()


def detect_external_delay(
    driver_location: str,
    destination: str,
    db: Session,
    user_id: Optional[int] = None,
    driver_id: Optional[str] = None,
    driver_speed: float = 20.0,
    distance_remaining: float = 3.0,
    historical_avg_speed: Optional[float] = None,
) -> dict:
    return _service.detect_external_delay(
        driver_location=driver_location,
        destination=destination,
        db=db,
        user_id=user_id,
        driver_id=driver_id,
        driver_speed=driver_speed,
        distance_remaining=distance_remaining,
        historical_avg_speed=historical_avg_speed,
    )