from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from app.database import SessionLocal
from app.models.premium_model import PremiumPayment
from app.schemas.premium_schema import PremiumCreate

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# PAY PREMIUM
@router.post("/pay")
def pay_premium(
    payment: PremiumCreate,
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):

    new_payment = PremiumPayment(
        user_id=payment.user_id,
        policy_id=payment.policy_id,
        amount=payment.amount
    )

    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)

    return {"message": "Premium paid successfully"}