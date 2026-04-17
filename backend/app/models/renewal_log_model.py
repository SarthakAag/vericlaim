"""
RenewalLog Model — VeriClaim AI Platform
Guidewire DEVTrails 2026

One row per enrollment per renewal cycle.
Feeds the admin dashboard renewal history tab.

outcome values:
    renewed              — premium paid, counters reset, enrollment continues
    expired              — end_date passed, enrollment moved to expired
    suspended            — auto_renew=False, enrollment moved to suspended
    skipped              — premium already paid this week (idempotency)
    error                — unexpected exception during processing
"""

from sqlalchemy import Column, Integer, Float, ForeignKey, String, DateTime, Date
from sqlalchemy.orm import relationship
from datetime import datetime, date

from app.database import Base


class RenewalLog(Base):
    __tablename__ = "renewal_logs"

    id             = Column(Integer, primary_key=True, index=True)

    # ── References ────────────────────────────────────────────────────────────
    enrollment_id  = Column(Integer, ForeignKey("policy_enrollments.id"),
                            nullable=False, index=True)
    user_id        = Column(Integer, ForeignKey("delivery_partners.id"),
                            nullable=False, index=True)

    # ── Cycle context ─────────────────────────────────────────────────────────
    run_id         = Column(String,  nullable=False, index=True)
    # e.g. "RENEW-20261103-000500"

    # ── Outcome ───────────────────────────────────────────────────────────────
    outcome        = Column(String,  nullable=False, index=True)
    # renewed / expired / suspended / skipped / error

    # ── Financials ────────────────────────────────────────────────────────────
    premium_inr    = Column(Float,   default=0.0)
    week_start     = Column(Date,    nullable=False, default=date.today)

    # ── Context snapshot ──────────────────────────────────────────────────────
    policy_tier    = Column(String,  nullable=True)
    zone           = Column(String,  nullable=True)

    # ── Error capture ─────────────────────────────────────────────────────────
    error_message  = Column(String,  nullable=True)

    # ── Timing ───────────────────────────────────────────────────────────────
    processed_at   = Column(DateTime, default=datetime.utcnow, index=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    enrollment     = relationship("PolicyEnrollment", backref="renewal_logs")
    driver         = relationship("DeliveryPartner",  backref="renewal_logs")