from sqlalchemy import Column, Integer, Float, ForeignKey
from app.database import Base


class DeliveryEarnings(Base):

    __tablename__ = "delivery_earnings"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("delivery_partners.id"))

    deliveries_completed = Column(Integer)

    distance_travelled = Column(Float)

    weather_bonus = Column(Float, default=0)

    traffic_bonus = Column(Float, default=0)

    total_earnings = Column(Float)