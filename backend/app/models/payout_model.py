"""
PayoutRecord Model  (NEW)
Persists every payout decision — approved / rejected / held.
This replaces the in-memory stub that was returning 0.0 for all weekly totals.

Also stores AI prediction history (replaces the in-memory _history list
in ai_delay_predictor.py) so risk profiles survive server restarts.
"""

from sqlalchemy import (
    Column, Integer, Float, ForeignKey,
    String, DateTime, Boolean, Date, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.database import Base


# ══════════════════════════════════════════════════════════════════════════════
class PayoutRecord(Base):
    """One row per payout decision (approved / rejected / held)."""

    __tablename__ = "payout_records"

    id                       = Column(Integer, primary_key=True, index=True)

    # ── Foreign keys ──────────────────────────────────────────────────────────
    user_id                  = Column(Integer, ForeignKey("delivery_partners.id"),  nullable=False, index=True)
    policy_id                = Column(Integer, ForeignKey("insurance_policies.id"), nullable=True)
    enrollment_id            = Column(Integer, ForeignKey("policy_enrollments.id"), nullable=True)

    # ── Unique payout reference ────────────────────────────────────────────────
    payout_reference         = Column(String, unique=True, nullable=False, index=True)
    # e.g. PAY-DRV001-20261103142300

    # ── Week this payout belongs to ───────────────────────────────────────────
    week_start               = Column(Date,    nullable=False, default=date.today, index=True)

    # ── Disruption details ────────────────────────────────────────────────────
    disruption_type          = Column(String,  nullable=True)   # extreme_rain / curfew …
    severity_level           = Column(String,  nullable=True)   # NONE … CRITICAL
    trigger_type             = Column(String,  nullable=True)   # parametric trigger label
    payout_tier_label        = Column(String,  nullable=True)   # full / partial / minimal
    coverage_hours_claimed   = Column(Float,   default=0.0)

    # ── Financial ─────────────────────────────────────────────────────────────
    base_payout_inr          = Column(Float,   default=0.0)
    final_payout_inr         = Column(Float,   default=0.0)
    weekly_income_used       = Column(Float,   default=0.0)     # snapshot of weekly_avg_income

    # ── Decision ──────────────────────────────────────────────────────────────
    status                   = Column(String,  nullable=False, default="pending", index=True)
    # status: approved / rejected / held_for_review / paid / failed
    rejection_reason         = Column(String,  nullable=True)

    # ── Fraud assessment snapshot ─────────────────────────────────────────────
    fraud_score              = Column(Integer, default=0)
    fraud_risk_level         = Column(String,  default="low")   # low / medium / high
    fraud_flags              = Column(JSON,    default=list)     # list of flag strings
    manual_review_required   = Column(Boolean, default=False)

    # ── Payment execution ─────────────────────────────────────────────────────
    payment_channel          = Column(String,  nullable=True)   # UPI_INSTANT / IMPS / NEFT
    payment_transaction_id   = Column(String,  nullable=True)
    paid_at                  = Column(DateTime, nullable=True)

    # ── Full AI calculation snapshot (for audit / appeal) ─────────────────────
    calculation_breakdown    = Column(JSON,    nullable=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    created_at               = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at               = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ─────────────────────────────────────────────────────────
    driver                   = relationship("DeliveryPartner",  back_populates="payouts")
    policy                   = relationship("InsurancePolicy",  back_populates="payouts")
    enrollment               = relationship("PolicyEnrollment", back_populates="payouts")


# ══════════════════════════════════════════════════════════════════════════════
class PredictionHistory(Base):
    """
    Persists every AI risk prediction so driver risk profiles
    survive server restarts (replaces the in-memory _history list).
    """

    __tablename__ = "prediction_history"

    id               = Column(Integer, primary_key=True, index=True)

    # ── Driver reference ──────────────────────────────────────────────────────
    user_id          = Column(Integer, ForeignKey("delivery_partners.id"), nullable=True, index=True)
    driver_ref       = Column(String,  nullable=True, index=True)  # string ID fallback

    # ── Prediction outputs ────────────────────────────────────────────────────
    risk_score       = Column(Float,   nullable=False)
    delay_level      = Column(String,  nullable=False)             # low/moderate/high/critical
    confidence       = Column(Float,   default=0.0)
    extra_minutes    = Column(Integer, default=0)

    # ── Parametric trigger ────────────────────────────────────────────────────
    trigger_type     = Column(String,  nullable=True)
    trigger_fired    = Column(Boolean, default=False)
    auto_claim_eligible = Column(Boolean, default=False)

    # ── Context snapshot ──────────────────────────────────────────────────────
    location         = Column(String,  nullable=True)
    traffic_level    = Column(String,  nullable=True)
    rain_mm_per_hr   = Column(Float,   default=0.0)
    temperature_c    = Column(Float,   default=0.0)
    aqi              = Column(Integer, default=0)
    driver_speed     = Column(Float,   default=0.0)
    flags            = Column(JSON,    default=list)
    risk_breakdown   = Column(JSON,    nullable=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    predicted_at     = Column(DateTime, default=datetime.utcnow, index=True)

    # ── Relationship ─────────────────────────────────────────────────────────
    driver           = relationship("DeliveryPartner", back_populates="predictions")