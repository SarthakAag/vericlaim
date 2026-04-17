"""
FraudAuditLog Model — VeriClaim AI Platform
Guidewire DEVTrails 2026

Immutable audit trail for every admin action on a fraud case.
One row per decision — approve / reject / escalate.
Used by the admin fraud panel to show "who did what and when".
"""

from sqlalchemy import (
    Column, Integer, Float, ForeignKey,
    String, DateTime, Text
)
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base


class FraudAuditLog(Base):
    """
    Immutable record of every admin fraud decision.

    action values:
        approved   — admin cleared the held claim → payout released
        rejected   — admin rejected the held claim → no payout
        escalated  — admin flagged for senior review (status → escalated)
    """

    __tablename__ = "fraud_audit_log"

    id                  = Column(Integer, primary_key=True, index=True)

    # ── What was acted on ─────────────────────────────────────────────────────
    payout_record_id    = Column(Integer, ForeignKey("payout_records.id"),
                                 nullable=False, index=True)
    user_id             = Column(Integer, ForeignKey("delivery_partners.id"),
                                 nullable=False, index=True)   # the driver

    # ── Who acted ─────────────────────────────────────────────────────────────
    admin_username      = Column(String,  nullable=False)
    admin_id            = Column(Integer, nullable=True)

    # ── Decision ──────────────────────────────────────────────────────────────
    action              = Column(String,  nullable=False, index=True)
    # approved / rejected / escalated

    previous_status     = Column(String,  nullable=True)   # status before action
    new_status          = Column(String,  nullable=True)   # status after action

    # ── Notes from admin ──────────────────────────────────────────────────────
    notes               = Column(Text,    nullable=True)

    # ── Financial snapshot at time of decision ────────────────────────────────
    payout_released_inr = Column(Float,   nullable=True)   # populated on approve

    # ── Metadata ──────────────────────────────────────────────────────────────
    acted_at            = Column(DateTime, default=datetime.utcnow, index=True)

    # ── Relationships ─────────────────────────────────────────────────────────
    payout_record       = relationship("PayoutRecord",     backref="audit_logs")
    driver              = relationship("DeliveryPartner",  backref="fraud_audit_logs")