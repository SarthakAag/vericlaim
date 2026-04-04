from pydantic import BaseModel, EmailStr
from typing import Optional


class RegisterUser(BaseModel):
    full_name:           str
    delivery_partner_id: str
    email:               EmailStr
    password:            str
    platform:            str
    age:                 int
    zone:                str = "default"       # ← added
    vehicle_type:        str = "two_wheeler"   # ← added


class LoginUser(BaseModel):
    email:    EmailStr
    password: str