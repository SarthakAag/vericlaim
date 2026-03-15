from pydantic import BaseModel


class EarningsCreate(BaseModel):

    deliveries_completed: int
    total_earnings: float