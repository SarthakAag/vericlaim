"""
DeliveryEarnings Model
Tracks weekly earnings per driver including disruption impact.
"""

from sqlalchemy import (
    Column, Integer, Float, ForeignKey,
    DateTime, Date, String
)
from sqlalchemy.orm import relationship
from datetime import datetime, date
from app.database import Base


class DeliveryEarnings(Base):
    __tablename__ = "delivery_earnings"

    id                   = Column(Integer, primary_key=True, index=True)

    # ── Foreign keys ──────────────────────────────────────────────────────────
    user_id              = Column(Integer, ForeignKey("delivery_partners.id"), nullable=False, index=True)
    policy_id            = Column(Integer, ForeignKey("insurance_policies.id"), nullable=True)

    # ── Week tracking (ISO Monday as week start) ──────────────────────────────
    week_start           = Column(Date, nullable=False, default=date.today, index=True)

    # ── Delivery activity ─────────────────────────────────────────────────────
    deliveries_completed = Column(Integer,  default=0)
    distance_travelled   = Column(Float,    default=0.0)   # km

    # ── Earnings breakdown ────────────────────────────────────────────────────
    base_earnings        = Column(Float,    default=0.0)   # platform pay
    weather_bonus        = Column(Float,    default=0.0)   # platform surge
    traffic_bonus        = Column(Float,    default=0.0)   # platform surge
    total_earnings       = Column(Float,    default=0.0)   # sum of above

    # ── Disruption impact  (income loss only — per problem rules) ─────────────
    disruption_hours     = Column(Float,    default=0.0)   # hours lost
    disruption_type      = Column(String,   nullable=True) # e.g. "heavy_rain"
    estimated_loss_inr   = Column(Float,    default=0.0)   # estimated income lost

    # ── Insurance payout received this week ───────────────────────────────────
    payout_received_inr  = Column(Float,    default=0.0)
    net_protected_income = Column(Float,    default=0.0)   # total_earnings + payout

    # ── Metadata ──────────────────────────────────────────────────────────────
    created_at           = Column(DateTime, default=datetime.utcnow)
    updated_at           = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # ── Relationships ─────────────────────────────────────────────────────────
    driver               = relationship("DeliveryPartner", back_populates="earnings")
    policy               = relationship("InsurancePolicy",  back_populates="earnings")