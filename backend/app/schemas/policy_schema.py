from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PolicyCreate(BaseModel):
    policy_name: str
    policy_tier: str                          # basic / standard / premium
    description: Optional[str] = None

    # Pricing
    weekly_premium: float

    # Coverage limits
    coverage_amount: float
    max_weekly_payout: float
    coverage_hours_per_week: int
    max_claims_per_week: int
    min_disruption_hours: float = 0.5

    # Income replacement
    income_covered_pct: float = Field(default=0.70, ge=0.0, le=1.0)

    # Eligibility
    is_active: bool = True
    min_weekly_income: float = 0.0
    max_weekly_income: float = 999_999.0


class PolicyUpdate(BaseModel):
    policy_name: Optional[str] = None
    description: Optional[str] = None

    weekly_premium: Optional[float] = None

    coverage_amount: Optional[float] = None
    max_weekly_payout: Optional[float] = None
    coverage_hours_per_week: Optional[int] = None
    max_claims_per_week: Optional[int] = None
    min_disruption_hours: Optional[float] = None

    income_covered_pct: Optional[float] = Field(default=None, ge=0.0, le=1.0)

    is_active: Optional[bool] = None
    min_weekly_income: Optional[float] = None
    max_weekly_income: Optional[float] = None


class PolicyResponse(BaseModel):
    id: int
    policy_name: str
    policy_tier: str
    description: Optional[str] = None

    weekly_premium: float

    coverage_amount: float
    max_weekly_payout: float
    coverage_hours_per_week: int
    max_claims_per_week: int
    min_disruption_hours: float

    income_covered_pct: float

    is_active: bool
    min_weekly_income: float
    max_weekly_income: float

    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True