"""
TriggerEvent Model
Logs every automated trigger-monitoring run so the admin dashboard
can show a real-time feed of what the scheduler found and acted on.

One row = one driver × one scheduler cycle.
"""

from sqlalchemy import (
    Column, Integer, Float, ForeignKey,
    String, DateTime, Boolean, JSON
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class TriggerEvent(Base):
    """
    Audit trail for every automated parametric trigger evaluation.

    status values:
        SKIPPED_NO_ENROLLMENT  — driver has no active policy
        SKIPPED_DUPLICATE      — same location fired within dedup window
        EVALUATED_NO_TRIGGER   — ran fine, risk too low to fire
        PAYOUT_INITIATED       — auto_claim_eligible → payout engine called
        PAYOUT_APPROVED        — payout engine returned APPROVED
        PAYOUT_REJECTED        — payout engine returned REJECTED
        PAYOUT_HELD            — payout engine returned HELD_FOR_REVIEW
        FRAUD_FLAGGED          — fraud_risk medium/high, held for review
        ERROR                  — unexpected exception during evaluation
    """

    __tablename__ = "trigger_events"

    id                    = Column(Integer, primary_key=True, index=True)

    # ── Who ───────────────────────────────────────────────────────────────────
    user_id               = Column(Integer, ForeignKey("delivery_partners.id"),
                                   nullable=False, index=True)
    enrollment_id         = Column(Integer, ForeignKey("policy_enrollments.id"),
                                   nullable=True)

    # ── Scheduler context ─────────────────────────────────────────────────────
    scheduler_run_id      = Column(String,  nullable=False, index=True)
    # e.g. "RUN-20261103-143000"  — groups all rows from same cycle

    # ── Location snapshot ─────────────────────────────────────────────────────
    driver_location       = Column(String,  nullable=True)
    destination           = Column(String,  nullable=True)

    # ── Detection output ──────────────────────────────────────────────────────
    status                = Column(String,  nullable=False, default="EVALUATED_NO_TRIGGER",
                                   index=True)
    disruption_type       = Column(String,  nullable=True)
    severity_level        = Column(String,  nullable=True)
    risk_score            = Column(Float,   default=0.0)
    delay_minutes         = Column(Integer, default=0)
    income_loss_inr       = Column(Float,   default=0.0)
    auto_claim_eligible   = Column(Boolean, default=False)
    fraud_risk            = Column(String,  default="low")
    fraud_flags           = Column(JSON,    default=list)

    # ── Payout result (populated when PAYOUT_* status) ────────────────────────
    payout_reference      = Column(String,  nullable=True)
    payout_amount_inr     = Column(Float,   nullable=True)
    payout_status         = Column(String,  nullable=True)

    # ── Error capture ─────────────────────────────────────────────────────────
    error_message         = Column(String,  nullable=True)

    # ── Full detection report (for drill-down in admin UI) ────────────────────
    detection_report      = Column(JSON,    nullable=True)

    # ── Timing ───────────────────────────────────────────────────────────────
    evaluated_at          = Column(DateTime, default=datetime.utcnow, index=True)
    processing_ms         = Column(Integer,  nullable=True)  # how long this row took

    # ── Relationships ─────────────────────────────────────────────────────────
    driver                = relationship("DeliveryPartner", backref="trigger_events")
    enrollment            = relationship("PolicyEnrollment", backref="trigger_events")