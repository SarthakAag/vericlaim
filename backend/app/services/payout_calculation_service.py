"""
Parametric Payout Calculation Engine
Guidewire DEVTrails 2026 — GigShield Insurance Platform

Full DB integration:
  READS:
    • InsurancePolicy    → coverage limits, tier config (not hard-coded anymore)
    • PolicyEnrollment   → weekly usage counters, active status
    • DeliveryEarnings   → weekly_avg_income (4-week rolling)
    • PayoutRecord       → paid_this_week (fixes the 0.0 stub)
    • PredictionHistory  → driver risk profile

  WRITES:
    • PayoutRecord       → every approved / rejected / held decision
    • PolicyEnrollment   → increments claims_this_week, coverage_hours_used,
                           payout_total_this_week after approval
    • DeliveryEarnings   → updates payout_received_inr + net_protected_income
"""

from __future__ import annotations

import logging
from datetime import datetime, date, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.payout_model     import PayoutRecord
from app.models.enrollment_model import PolicyEnrollment
from app.models.policy_model     import InsurancePolicy
from app.models.earnings_model   import DeliveryEarnings
from app.models.payout_model     import PredictionHistory

logger = logging.getLogger(__name__)


# ─── Payout multiplier by disruption type (income loss ONLY) ──────────────────
PAYOUT_MULTIPLIERS: dict[str, float] = {
    "extreme_rain": 1.00, "heavy_rain": 0.75, "flood": 1.00,
    "cyclone": 1.00,      "curfew": 1.00,     "strike": 0.90,
    "severe_heat": 0.65,  "severe_aqi": 0.55, "road_closure": 0.70,
    "low_visibility": 0.50, "operational_delay": 0.30, "none": 0.00,
}

PAYOUT_TIER_FRACTION: dict[str, float] = {
    "full": 1.00, "partial": 0.60, "minimal": 0.30, "none": 0.00,
}

FRAUD_PAYOUT_FACTOR: dict[str, float] = {
    "low": 1.0, "medium": 0.0, "high": 0.0,
}

SEASONAL_PREMIUM_ADDON: dict[int, float] = {
    10: 0.15, 11: 0.20, 12: 0.10, 5: 0.08, 6: 0.05,
}

# Channel routing thresholds
_UPI_LIMIT  = 200
_IMPS_LIMIT = 1_000


# ══════════════════════════════════════════════════════════════════════════════
class PayoutCalculationService:

    # ──────────────────────────────────────────────────────────────────────────
    # MAIN PAYOUT CALCULATION
    # ──────────────────────────────────────────────────────────────────────────

    def calculate_payout(
        self,
        db: Session,
        user_id: int,
        disruption_event: dict,
        driver_risk_profile: Optional[dict] = None,
    ) -> dict:
        """
        Full parametric payout decision with DB read/write.

        DB reads  → enrollment, policy limits, paid-this-week, weekly income
        DB writes → PayoutRecord (every decision), PolicyEnrollment counters,
                    DeliveryEarnings payout fields (on approval)
        """
        now = datetime.utcnow()

        # ── Fetch enrollment + policy from DB ─────────────────────────────────
        enrollment = self._get_active_enrollment(db, user_id)
        if not enrollment:
            return self._build_rejected(
                user_id=user_id,
                disruption_type=disruption_event.get("disruption_type", "none"),
                reason="NO_ACTIVE_POLICY_ENROLLMENT",
                fraud=disruption_event.get("fraud_assessment", {}),
                now=now,
            )

        policy = db.query(InsurancePolicy).filter(
            InsurancePolicy.id == enrollment.policy_id
        ).first()
        if not policy:
            return self._build_rejected(
                user_id=user_id,
                disruption_type=disruption_event.get("disruption_type", "none"),
                reason="POLICY_NOT_FOUND",
                fraud=disruption_event.get("fraud_assessment", {}),
                now=now,
            )

        # ── Extract event fields ──────────────────────────────────────────────
        parametric      = disruption_event.get("parametric_trigger", {})
        fraud           = disruption_event.get("fraud_assessment",   {})
        income_loss_est = disruption_event.get("income_loss_estimate", {})
        disruption_type = disruption_event.get("disruption_type", "none")
        severity        = disruption_event.get("severity_level",    "NONE")
        delay_hours     = income_loss_est.get("delay_hours", 0.0)

        # ── Weekly income from DB ─────────────────────────────────────────────
        weekly_avg_income = self._get_weekly_avg_income(db, user_id)

        # ── Paid this week from DB (fixes the 0.0 stub) ───────────────────────
        paid_this_week    = self._get_paid_this_week(db, user_id)

        # ── Eligibility check ─────────────────────────────────────────────────
        eligibility = self._check_eligibility(
            policy, enrollment, delay_hours, parametric, fraud, paid_this_week
        )
        if not eligibility["eligible"]:
            record = self._build_rejected(
                user_id=user_id,
                disruption_type=disruption_type,
                reason=eligibility["rejection_reason"],
                fraud=fraud,
                now=now,
                enrollment_id=enrollment.id,
                policy_id=policy.id,
            )
            self._write_payout_record(db, record, enrollment, week_start=date.today())
            return record

        # ── Payout maths ──────────────────────────────────────────────────────
        daily_income  = weekly_avg_income / 6
        hourly_income = daily_income / 10

        trigger_type      = parametric.get("trigger_type") or disruption_type
        trigger_mult      = PAYOUT_MULTIPLIERS.get(trigger_type, 0.30)
        payout_tier_label = parametric.get("payout_tier", "partial")
        tier_fraction     = PAYOUT_TIER_FRACTION.get(payout_tier_label, 0.60)

        trigger_hours = min(
            parametric.get("coverage_hours", delay_hours),
            policy.coverage_hours_per_week - enrollment.coverage_hours_used_this_week,
        )

        base_payout = (
            hourly_income
            * policy.income_covered_pct
            * trigger_mult
            * tier_fraction
            * trigger_hours
        )

        # Weekly cap enforcement (from DB)
        remaining_cap = policy.max_weekly_payout - paid_this_week
        capped_payout = min(base_payout, remaining_cap)

        # Fraud gate
        fraud_risk   = fraud.get("fraud_risk", "low")
        fraud_factor = FRAUD_PAYOUT_FACTOR.get(fraud_risk, 0.0)

        if fraud_factor == 0.0:
            held = self._build_held(
                user_id, disruption_type, fraud, capped_payout, now,
                enrollment_id=enrollment.id, policy_id=policy.id
            )
            self._write_payout_record(db, held, enrollment, week_start=date.today())
            return held

        # Driver risk-profile fine-tuning
        final_payout = capped_payout * fraud_factor
        if driver_risk_profile:
            risk_adj = {
                "low": 1.05, "medium": 1.00, "high": 0.90
            }.get(driver_risk_profile.get("risk_tier", "medium"), 1.0)
            final_payout *= risk_adj

        final_payout = round(final_payout, 2)

        breakdown = {
            "weekly_avg_income_inr": weekly_avg_income,
            "daily_income_inr":      round(daily_income, 2),
            "hourly_income_inr":     round(hourly_income, 2),
            "coverage_pct":          policy.income_covered_pct,
            "trigger_multiplier":    trigger_mult,
            "tier_fraction":         tier_fraction,
            "coverage_hours":        trigger_hours,
            "base_payout_inr":       round(base_payout, 2),
            "after_cap_inr":         round(capped_payout, 2),
            "fraud_factor":          fraud_factor,
            "final_payout_inr":      final_payout,
            "paid_this_week_before": paid_this_week,
        }

        result = {
            "payout_id":         self._payout_ref(user_id, now),
            "user_id":           user_id,
            "status":            "APPROVED",
            "payout_amount_inr": final_payout,
            "currency":          "INR",
            "policy_tier":       enrollment.policy_tier,
            "disruption_type":   disruption_type,
            "severity_level":    severity,
            "trigger_type":      trigger_type,
            "payout_tier":       payout_tier_label,
            "coverage_hours_claimed": trigger_hours,
            "calculation_breakdown": breakdown,
            "policy_limits": {
                "max_weekly_payout_inr":      policy.max_weekly_payout,
                "coverage_hours_remaining":   max(
                    0,
                    policy.coverage_hours_per_week
                    - enrollment.coverage_hours_used_this_week
                    - trigger_hours
                ),
                "claims_remaining_this_week": max(
                    0, policy.max_claims_per_week - enrollment.claims_this_week - 1
                ),
            },
            "fraud_assessment":        fraud,
            "timestamp":               now.isoformat(),
            "payout_channel":          self._channel(final_payout),
            "estimated_transfer_time": self._transfer_time(final_payout),
            "enrollment_id":           enrollment.id,
            "policy_id":               policy.id,
        }

        # ── DB writes ─────────────────────────────────────────────────────────
        self._write_payout_record(db, result, enrollment, date.today(), breakdown)
        self._update_enrollment_counters(
            db, enrollment, trigger_hours, final_payout
        )
        self._update_earnings_record(db, user_id, final_payout)

        return result

    # ──────────────────────────────────────────────────────────────────────────
    # WEEKLY PREMIUM CALCULATOR  (reads policy + enrollment from DB)
    # ──────────────────────────────────────────────────────────────────────────

    def calculate_weekly_premium(
        self,
        db: Session,
        user_id: int,
        policy_tier: str,
        driver_risk_profile: Optional[dict] = None,
        zone_flood_risk: float = 0.50,
    ) -> dict:
        """
        Dynamic premium using DB policy config + risk adjustments.
        Reads InsurancePolicy for base_premium and coverage limits.
        """
        policy = db.query(InsurancePolicy).filter(
            InsurancePolicy.policy_tier == policy_tier.lower(),
            InsurancePolicy.is_active   == True,
        ).first()

        if not policy:
            return {"error": f"Policy tier '{policy_tier}' not found or inactive"}

        weekly_avg_income = self._get_weekly_avg_income(db, user_id)
        base_premium      = policy.weekly_premium

        # Risk adjustments
        zone_adj     = (zone_flood_risk - 0.5) * 0.40
        risk_adj     = 0.0
        if driver_risk_profile:
            risk_adj = {"low": -0.10, "medium": 0.0, "high": 0.15}.get(
                driver_risk_profile.get("risk_tier", "medium"), 0.0
            )
        seasonal_adj = SEASONAL_PREMIUM_ADDON.get(datetime.utcnow().month, 0.0)

        # Affordability cap: ≤ 3% of weekly income
        max_affordable = weekly_avg_income * 0.03
        raw_premium    = base_premium * (1 + zone_adj + risk_adj + seasonal_adj)
        final_premium  = round(min(raw_premium, max_affordable), 2)

        return {
            "policy_tier":              policy_tier,
            "policy_id":                policy.id,
            "base_premium_inr":         base_premium,
            "final_weekly_premium_inr": final_premium,
            "premium_breakdown": {
                "base_inr":                base_premium,
                "zone_adjustment_pct":     round(zone_adj     * 100, 1),
                "risk_adjustment_pct":     round(risk_adj     * 100, 1),
                "seasonal_adjustment_pct": round(seasonal_adj * 100, 1),
            },
            "affordability_check": {
                "weekly_income_inr":          weekly_avg_income,
                "max_affordable_premium_inr": round(max_affordable, 2),
                "premium_to_income_ratio_pct": round(
                    final_premium / weekly_avg_income * 100, 2
                ) if weekly_avg_income else 0,
            },
            "coverage_summary": {
                "max_weekly_payout_inr":      policy.max_weekly_payout,
                "coverage_hours_per_week":    policy.coverage_hours_per_week,
                "max_claims_per_week":        policy.max_claims_per_week,
                "payout_to_premium_ratio":    round(
                    policy.max_weekly_payout / final_premium, 1
                ) if final_premium else 0,
            },
        }

    # ──────────────────────────────────────────────────────────────────────────
    # DB READS
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _get_active_enrollment(db: Session, user_id: int) -> Optional[PolicyEnrollment]:
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
    def _get_weekly_avg_income(db: Session, user_id: int) -> float:
        """4-week rolling average from delivery_earnings."""
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
    def _get_paid_this_week(db: Session, user_id: int) -> float:
        """
        Real DB query — replaces the 0.0 stub.
        Sums all APPROVED payouts for this driver since Monday.
        """
        today      = date.today()
        week_start = today - timedelta(days=today.weekday())  # Monday
        result = (
            db.query(func.coalesce(func.sum(PayoutRecord.final_payout_inr), 0.0))
            .filter(
                PayoutRecord.user_id    == user_id,
                PayoutRecord.status     == "approved",
                PayoutRecord.week_start == week_start,
            )
            .scalar()
        )
        return float(result)

    # ──────────────────────────────────────────────────────────────────────────
    # DB WRITES
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _write_payout_record(
        db: Session,
        result: dict,
        enrollment: PolicyEnrollment,
        week_start: date,
        breakdown: Optional[dict] = None,
    ) -> None:
        try:
            fraud = result.get("fraud_assessment", {})
            record = PayoutRecord(
                user_id                = result["user_id"],
                policy_id              = result.get("policy_id"),
                enrollment_id          = result.get("enrollment_id") or enrollment.id,
                payout_reference       = result.get("payout_id", ""),
                week_start             = week_start,
                disruption_type        = result.get("disruption_type"),
                severity_level         = result.get("severity_level"),
                trigger_type           = result.get("trigger_type"),
                payout_tier_label      = result.get("payout_tier"),
                coverage_hours_claimed = result.get("coverage_hours_claimed", 0),
                final_payout_inr       = result.get("payout_amount_inr", 0),
                status                 = result.get("status", "pending").lower(),
                rejection_reason       = result.get("rejection_reason"),
                fraud_score            = fraud.get("fraud_score", 0),
                fraud_risk_level       = fraud.get("fraud_risk", "low"),
                fraud_flags            = fraud.get("flags", []),
                manual_review_required = fraud.get("manual_review_required", False),
                payment_channel        = result.get("payout_channel"),
                calculation_breakdown  = breakdown,
            )
            db.add(record)
            db.commit()
            db.refresh(record)
        except Exception as exc:
            db.rollback()
            logger.error(f"[Payout] Failed to write PayoutRecord: {exc}")

    @staticmethod
    def _update_enrollment_counters(
        db: Session,
        enrollment: PolicyEnrollment,
        trigger_hours: float,
        payout_inr: float,
    ) -> None:
        """Increment weekly usage counters on the enrollment row."""
        try:
            enrollment.claims_this_week              += 1
            enrollment.coverage_hours_used_this_week += trigger_hours
            enrollment.payout_total_this_week        += payout_inr
            enrollment.total_claims                  += 1
            enrollment.total_payout_received         += payout_inr
            enrollment.updated_at                    =  datetime.utcnow()
            db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"[Payout] Failed to update enrollment counters: {exc}")

    @staticmethod
    def _update_earnings_record(
        db: Session, user_id: int, payout_inr: float
    ) -> None:
        """Update this week's earnings row with the received payout."""
        try:
            week_start = date.today() - timedelta(days=date.today().weekday())
            row = (
                db.query(DeliveryEarnings)
                .filter(
                    DeliveryEarnings.user_id    == user_id,
                    DeliveryEarnings.week_start == week_start,
                )
                .first()
            )
            if row:
                row.payout_received_inr  = (row.payout_received_inr or 0) + payout_inr
                row.net_protected_income = (row.total_earnings or 0) + row.payout_received_inr
                row.updated_at           = datetime.utcnow()
                db.commit()
        except Exception as exc:
            db.rollback()
            logger.error(f"[Payout] Failed to update earnings record: {exc}")

    # ──────────────────────────────────────────────────────────────────────────
    # ELIGIBILITY
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _check_eligibility(
        policy: InsurancePolicy,
        enrollment: PolicyEnrollment,
        delay_hours: float,
        parametric: dict,
        fraud: dict,
        paid_this_week: float,
    ) -> dict:
        if enrollment.status != "active":
            return {"eligible": False, "rejection_reason": "ENROLLMENT_NOT_ACTIVE"}
        if enrollment.claims_this_week >= policy.max_claims_per_week:
            return {"eligible": False, "rejection_reason": "WEEKLY_CLAIM_LIMIT_REACHED"}
        if enrollment.coverage_hours_used_this_week >= policy.coverage_hours_per_week:
            return {"eligible": False, "rejection_reason": "COVERAGE_HOURS_EXHAUSTED"}
        if delay_hours < policy.min_disruption_hours:
            return {
                "eligible": False,
                "rejection_reason": f"DISRUPTION_BELOW_MIN_{policy.min_disruption_hours}H",
            }
        if paid_this_week >= policy.max_weekly_payout:
            return {"eligible": False, "rejection_reason": "WEEKLY_PAYOUT_CAP_REACHED"}
        if not parametric.get("triggered"):
            return {"eligible": False, "rejection_reason": "NO_PARAMETRIC_TRIGGER"}
        if fraud.get("fraud_risk") == "high":
            return {"eligible": False, "rejection_reason": "FRAUD_RISK_HIGH"}
        return {"eligible": True, "rejection_reason": None}

    # ──────────────────────────────────────────────────────────────────────────
    # RESPONSE BUILDERS
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _build_rejected(
        user_id: int, disruption_type: str, reason: str,
        fraud: dict, now: datetime,
        enrollment_id: Optional[int] = None,
        policy_id: Optional[int] = None,
    ) -> dict:
        return {
            "payout_id":         PayoutCalculationService._payout_ref(user_id, now),
            "user_id":           user_id,
            "status":            "REJECTED",
            "payout_amount_inr": 0.0,
            "rejection_reason":  reason,
            "disruption_type":   disruption_type,
            "fraud_assessment":  fraud,
            "timestamp":         now.isoformat(),
            "enrollment_id":     enrollment_id,
            "policy_id":         policy_id,
        }

    @staticmethod
    def _build_held(
        user_id: int, disruption_type: str,
        fraud: dict, tentative: float, now: datetime,
        enrollment_id: Optional[int] = None,
        policy_id: Optional[int] = None,
    ) -> dict:
        return {
            "payout_id":            PayoutCalculationService._payout_ref(user_id, now),
            "user_id":              user_id,
            "status":               "HELD_FOR_REVIEW",
            "payout_amount_inr":    0.0,
            "tentative_amount_inr": tentative,
            "rejection_reason":     "FRAUD_MEDIUM_RISK_MANUAL_REVIEW",
            "disruption_type":      disruption_type,
            "fraud_assessment":     fraud,
            "timestamp":            now.isoformat(),
            "enrollment_id":        enrollment_id,
            "policy_id":            policy_id,
        }

    # ──────────────────────────────────────────────────────────────────────────
    # UTILITIES
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _payout_ref(user_id: int, ts: datetime) -> str:
        return f"PAY-{str(user_id).zfill(6)}-{ts.strftime('%Y%m%d%H%M%S')}"

    @staticmethod
    def _channel(amount: float) -> str:
        if amount <= _UPI_LIMIT:  return "UPI_INSTANT"
        if amount <= _IMPS_LIMIT: return "IMPS"
        return "NEFT"

    @staticmethod
    def _transfer_time(amount: float) -> str:
        if amount <= _UPI_LIMIT:  return "Instant (< 30 seconds)"
        if amount <= _IMPS_LIMIT: return "Within 2 minutes (IMPS)"
        return "Within 30 minutes (NEFT)"


# ─── Singleton + entry points ─────────────────────────────────────────────────
_service = PayoutCalculationService()


def calculate_payout(
    db: Session,
    user_id: int,
    disruption_event: dict,
    driver_risk_profile: Optional[dict] = None,
) -> dict:
    return _service.calculate_payout(
        db=db, user_id=user_id,
        disruption_event=disruption_event,
        driver_risk_profile=driver_risk_profile,
    )


def calculate_weekly_premium(
    db: Session,
    user_id: int,
    policy_tier: str,
    driver_risk_profile: Optional[dict] = None,
    zone_flood_risk: float = 0.50,
) -> dict:
    return _service.calculate_weekly_premium(
        db=db, user_id=user_id, policy_tier=policy_tier,
        driver_risk_profile=driver_risk_profile,
        zone_flood_risk=zone_flood_risk,
    )


def calculate_extra_payout(base_pay: float, delay_minutes: int) -> float:
    """Legacy shim — preserved for old callers."""
    return base_pay + (delay_minutes * 2)