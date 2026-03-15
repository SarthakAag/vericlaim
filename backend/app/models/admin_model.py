from sqlalchemy import Column, Integer, String
from app.database import Base

class Admin(Base):
    __tablename__ = "admins"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    email = Column(String, unique=True)
    username = Column(String, unique=True)
    password_hash = Column(String)