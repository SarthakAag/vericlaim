from pydantic import BaseModel
from datetime import date, datetime
from typing import Optional


class PremiumCreate(BaseModel):
    # user_id is NOT here — extracted from JWT in the router
    policy_id:      int
    amount:         float
    payment_method: str = "UPI"   # UPI / IMPS / NEFT


class PremiumResponse(BaseModel):
    id:             int
    user_id:        int
    policy_id:      int
    base_amount:    float
    final_amount:   float
    payment_method: str
    transaction_id: Optional[str] = None
    status:         str
    week_start:     date
    week_end:       Optional[date] = None
    payment_date:   Optional[datetime] = None

    class Config:
        from_attributes = True