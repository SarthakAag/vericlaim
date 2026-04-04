from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class EnrollmentCreate(BaseModel):
    policy_id:  int
    home_zone:  Optional[str] = None
    auto_renew: bool = True


class EnrollmentResponse(BaseModel):
    id:                           int
    user_id:                      int
    policy_id:                    int
    policy_tier:                  str
    weekly_premium_paid:          float
    status:                       str
    start_date:                   date
    auto_renew:                   bool

    # ── Fields the frontend reads in the history table & active card ──────────
    enrolled_at:                  Optional[datetime] = None
    home_zone:                    Optional[str]      = None
    claims_this_week:             Optional[int]      = 0
    coverage_hours_used_this_week:Optional[float]    = 0.0
    payout_total_this_week:       Optional[float]    = 0.0
    total_claims:                 Optional[int]      = 0
    total_payout_received:        Optional[float]    = 0.0
    total_premiums_paid:          Optional[float]    = 0.0

    class Config:
        from_attributes = True