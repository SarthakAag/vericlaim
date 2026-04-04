# backend/app/models/user_model.py

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base

class DeliveryPartner(Base):
    __tablename__ = "delivery_partners"

    id                  = Column(Integer, primary_key=True, index=True)
    full_name           = Column(String)
    delivery_partner_id = Column(String, unique=True)
    email               = Column(String, unique=True)
    password_hash       = Column(String)
    platform            = Column(String)   # "zomato" | "swiggy" | "both"  ← already exists
    age                 = Column(Integer)

    # ── ADD THESE TWO ─────────────────────────────────────────────
    zone         = Column(String, default="default")
    # velachery | adyar | porur | tambaram | chromepet |
    # kodambakkam | perambur | t_nagar | anna_nagar | guindy | omr

    vehicle_type = Column(String, default="two_wheeler")
    # "two_wheeler" | "bicycle" | "ev_scooter"
    # ──────────────────────────────────────────────────────────────

    enrollments      = relationship("PolicyEnrollment",  back_populates="driver")
    earnings         = relationship("DeliveryEarnings",  back_populates="driver")
    payouts          = relationship("PayoutRecord",      back_populates="driver")
    premium_payments = relationship("PremiumPayment",    back_populates="driver")
    predictions      = relationship("PredictionHistory", back_populates="driver")