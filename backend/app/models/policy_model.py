"""
InsurancePolicy Model
Master policy definition. One row per tier (Basic / Standard / Premium).
"""

from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id                       = Column(Integer, primary_key=True, index=True)

    # ── Identity ──────────────────────────────────────────────────────────────
    policy_name              = Column(String, nullable=False)
    policy_tier              = Column(String, nullable=False, unique=True, index=True)
    # tier values: basic / standard / premium
    description              = Column(String, nullable=True)

    # ── Pricing (weekly — per problem rules) ──────────────────────────────────
    weekly_premium           = Column(Float,   nullable=False)   # base INR/week

    # ── Coverage limits ───────────────────────────────────────────────────────
    coverage_amount          = Column(Float,   nullable=False)   # max single payout INR
    max_weekly_payout        = Column(Float,   nullable=False)   # weekly cap INR
    coverage_hours_per_week  = Column(Integer, nullable=False)   # hours of income covered
    max_claims_per_week      = Column(Integer, nullable=False)   # claim frequency cap
    min_disruption_hours     = Column(Float,   default=0.5)      # minimum hours to trigger

    # ── Income replacement rate ───────────────────────────────────────────────
    income_covered_pct       = Column(Float,   default=0.70)     # 0.0–1.0

    # ── Eligibility ───────────────────────────────────────────────────────────
    is_active                = Column(Boolean, default=True)
    min_weekly_income        = Column(Float,   default=0.0)
    max_weekly_income        = Column(Float,   default=999_999.0)

    # ── Metadata ──────────────────────────────────────────────────────────────
    created_at               = Column(DateTime, default=datetime.utcnow)
    updated_at               = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ─────────────────────────────────────────────────────────
    enrollments              = relationship("PolicyEnrollment", back_populates="policy")
    premium_payments         = relationship("PremiumPayment",   back_populates="policy")
    earnings                 = relationship("DeliveryEarnings", back_populates="policy")
    payouts                  = relationship("PayoutRecord",     back_populates="policy")