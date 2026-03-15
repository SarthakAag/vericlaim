from pydantic import BaseModel

class EnrollmentCreate(BaseModel):
    policy_name: str