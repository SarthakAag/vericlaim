from pydantic import BaseModel

class AdminRegister(BaseModel):
    full_name: str
    email: str
    username: str
    password: str


class AdminLogin(BaseModel):
    username: str
    password: str