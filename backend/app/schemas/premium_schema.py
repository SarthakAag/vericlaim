from pydantic import BaseModel

class PremiumCreate(BaseModel):
    user_id: int
    policy_id: int
    amount: float


class PremiumResponse(BaseModel):
    id: int
    user_id: int
    policy_id: int
    amount: float
    status: str