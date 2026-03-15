from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user_model import DeliveryPartner


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(email: str, db: Session = Depends(get_db)):

    user = db.query(DeliveryPartner).filter(DeliveryPartner.email == email).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")

    return user