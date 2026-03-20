from pydantic import BaseModel
from typing import Optional
from datetime import date


class EnrollmentCreate(BaseModel):
    policy_id: int
    home_zone: Optional[str] = None
    auto_renew: bool = True


class EnrollmentResponse(BaseModel):
    id: int
    user_id: int
    policy_id: int
    policy_tier: str
    weekly_premium_paid: float
    status: str
    start_date: date
    auto_renew: bool

    class Config:
        from_attributes = True