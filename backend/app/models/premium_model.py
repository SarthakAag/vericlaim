"""
PremiumPayment Model
Records every weekly premium payment with full audit fields.
"""

from sqlalchemy import (
    Column, Integer, Float, ForeignKey,
    String, DateTime, Date, Boolean
)
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.database import Base


class PremiumPayment(Base):
    __tablename__ = "premium_payments"

    id                   = Column(Integer, primary_key=True, index=True)

    # ── Foreign keys ──────────────────────────────────────────────────────────
    user_id              = Column(Integer, ForeignKey("delivery_partners.id"), nullable=False, index=True)
    policy_id            = Column(Integer, ForeignKey("insurance_policies.id"), nullable=False)

    # ── Week this premium covers ───────────────────────────────────────────────
    week_start           = Column(Date,    nullable=False, default=date.today, index=True)
    week_end             = Column(Date,    nullable=True)

    # ── Payment details ───────────────────────────────────────────────────────
    base_amount          = Column(Float,   nullable=False)         # tier base price
    final_amount         = Column(Float,   nullable=False)         # after risk adjustments
    zone_adjustment_pct  = Column(Float,   default=0.0)
    risk_adjustment_pct  = Column(Float,   default=0.0)
    seasonal_adj_pct     = Column(Float,   default=0.0)

    # ── Payment method + status ───────────────────────────────────────────────
    payment_method       = Column(String,  default="UPI")          # UPI / IMPS / NEFT
    transaction_id       = Column(String,  nullable=True, unique=True)
    status               = Column(String,  default="pending")      # pending/paid/failed/refunded

    # ── Risk context at time of payment ──────────────────────────────────────
    driver_risk_tier     = Column(String,  default="medium")       # low/medium/high
    zone_flood_risk      = Column(Float,   default=0.50)
    policy_tier          = Column(String,  default="standard")     # basic/standard/premium

    # ── Auto-renewal flag ─────────────────────────────────────────────────────
    is_auto_renewed      = Column(Boolean, default=False)

    # ── Metadata ──────────────────────────────────────────────────────────────
    payment_date         = Column(DateTime, default=datetime.utcnow, index=True)
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ─────────────────────────────────────────────────────────
    driver               = relationship("DeliveryPartner", back_populates="premium_payments")
    policy               = relationship("InsurancePolicy",  back_populates="premium_payments")