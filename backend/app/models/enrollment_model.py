from sqlalchemy import Column, Integer, ForeignKey, String
from app.database import Base

class PolicyEnrollment(Base):
    __tablename__ = "policy_enrollments"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("delivery_partners.id"))
    policy_id = Column(Integer, ForeignKey("insurance_policies.id"))

    status = Column(String, default="active")