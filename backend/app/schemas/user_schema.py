from pydantic import BaseModel

class RegisterUser(BaseModel):
    full_name: str
    delivery_partner_id: str
    email: str
    password: str
    platform: str
    age: int


class LoginUser(BaseModel):
    email: str
    password: str