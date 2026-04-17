# backend/app/models/user_model.py

from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class DeliveryPartner(Base):
    __tablename__ = "delivery_partners"

    id                  = Column(Integer, primary_key=True, index=True)
    full_name           = Column(String, nullable=False)

    # 🔥 IDENTIFIERS
    delivery_partner_id = Column(String, unique=True, nullable=True)
    driver_ref          = Column(String, unique=True, nullable=True)  # ✅ ADDED

    # 🔥 CONTACT
    email               = Column(String, unique=True, nullable=False)
    phone               = Column(String, unique=True, nullable=True)

    # 🔐 AUTH
    password_hash       = Column(String, nullable=False)

    # 📦 PROFILE
    platform            = Column(String)   # "zomato" | "swiggy" | "both"
    age                 = Column(Integer)

    # 📍 LOCATION + VEHICLE
    zone         = Column(String, default="default")
    vehicle_type = Column(String, default="two_wheeler")

    # 🔗 RELATIONSHIPS
    enrollments      = relationship("PolicyEnrollment",  back_populates="driver")
    earnings         = relationship("DeliveryEarnings",  back_populates="driver")
    payouts          = relationship("PayoutRecord",      back_populates="driver")
    premium_payments = relationship("PremiumPayment",    back_populates="driver")
    predictions      = relationship("PredictionHistory", back_populates="driver")