from sqlalchemy import Column, Integer, String
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