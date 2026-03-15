from sqlalchemy import Column, Integer, String, Float
from app.database import Base

class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"

    id = Column(Integer, primary_key=True, index=True)
    policy_name = Column(String)
    coverage_amount = Column(Float)
    weekly_premium = Column(Float)
    description = Column(String)