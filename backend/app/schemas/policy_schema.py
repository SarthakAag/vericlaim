from pydantic import BaseModel

class PolicyCreate(BaseModel):
    policy_name: str
    coverage_amount: float
    weekly_premium: float
    description: str


class PolicyResponse(BaseModel):
    id: int
    policy_name: str
    coverage_amount: float
    weekly_premium: float
    description: str

    class Config:
        from_attributes = True