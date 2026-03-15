from sqlalchemy import Column, Integer, Float, ForeignKey, String, DateTime
from datetime import datetime
from app.database import Base

class PremiumPayment(Base):
    __tablename__ = "premium_payments"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("delivery_partners.id"))
    policy_id = Column(Integer, ForeignKey("insurance_policies.id"))

    amount = Column(Float)

    payment_date = Column(DateTime, default=datetime.utcnow)

    status = Column(String, default="paid")