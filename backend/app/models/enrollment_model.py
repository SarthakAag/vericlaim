"""
PolicyEnrollment Model
Tracks a driver's active policy including real-time weekly usage.
This is the central record the payout engine reads to enforce limits.
"""

from sqlalchemy import (
    Column, Integer, Float, ForeignKey,
    String, DateTime, Date, Boolean
)
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.database import Base


class PolicyEnrollment(Base):
    __tablename__ = "policy_enrollments"

    id                           = Column(Integer, primary_key=True, index=True)

    # ── Foreign keys ──────────────────────────────────────────────────────────
    user_id                      = Column(Integer, ForeignKey("delivery_partners.id"), nullable=False, index=True)
    policy_id                    = Column(Integer, ForeignKey("insurance_policies.id"), nullable=False)

    # ── Policy tier snapshot at enrolment time ────────────────────────────────
    policy_tier                  = Column(String, nullable=False, default="standard")  # basic/standard/premium
    weekly_premium_paid          = Column(Float,  nullable=False, default=0.0)

    # ── Enrollment window ─────────────────────────────────────────────────────
    start_date                   = Column(Date,    nullable=False, default=date.today)
    end_date                     = Column(Date,    nullable=True)   # NULL = open-ended
    status                       = Column(String,  default="active", index=True)
    # status values: active / expired / suspended / cancelled

    # ── Current week usage counters (reset every Monday) ─────────────────────
    week_start                   = Column(Date,    nullable=False, default=date.today, index=True)
    claims_this_week             = Column(Integer, default=0)
    coverage_hours_used_this_week= Column(Float,   default=0.0)
    payout_total_this_week       = Column(Float,   default=0.0)     # INR paid out this week

    # ── Lifetime counters ─────────────────────────────────────────────────────
    total_claims                 = Column(Integer, default=0)
    total_payout_received        = Column(Float,   default=0.0)     # INR lifetime
    total_premiums_paid          = Column(Float,   default=0.0)     # INR lifetime

    # ── Driver location context (for zone-risk premium adjustment) ────────────
    home_zone                    = Column(String,  nullable=True)    # e.g. "velachery"
    zone_flood_risk              = Column(Float,   default=0.50)

    # ── Auto-renew preference ─────────────────────────────────────────────────
    auto_renew                   = Column(Boolean, default=True)

    # ── Metadata ──────────────────────────────────────────────────────────────
    enrolled_at                  = Column(DateTime, default=datetime.utcnow)
    updated_at                   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ─────────────────────────────────────────────────────────
    driver                       = relationship("DeliveryPartner", back_populates="enrollments")
    policy                       = relationship("InsurancePolicy",  back_populates="enrollments")
    payouts                      = relationship("PayoutRecord",     back_populates="enrollment")