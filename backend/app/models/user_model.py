from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base

class DeliveryPartner(Base):
    __tablename__ = "delivery_partners"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    delivery_partner_id = Column(String, unique=True)
    email = Column(String, unique=True)
    password_hash = Column(String)
    platform = Column(String)
    age = Column(Integer)

    enrollments      = relationship("PolicyEnrollment",  back_populates="driver")
    earnings         = relationship("DeliveryEarnings",  back_populates="driver")
    payouts          = relationship("PayoutRecord",      back_populates="driver")
    premium_payments = relationship("PremiumPayment",    back_populates="driver")
    predictions      = relationship("PredictionHistory", back_populates="driver")