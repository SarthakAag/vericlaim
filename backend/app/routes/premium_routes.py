from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
from datetime import date, timedelta
import uuid

from app.database import SessionLocal
from app.models.premium_model import PremiumPayment
from app.models.user_model import DeliveryPartner
from app.schemas.premium_schema import PremiumCreate, PremiumResponse
from app.utils.jwt_handler import decode_access_token

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> DeliveryPartner:
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token payload")
    user = db.query(DeliveryPartner).filter(DeliveryPartner.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── PAY PREMIUM ───────────────────────────────────────────────────────────────
@router.post("/pay", response_model=PremiumResponse)
def pay_premium(
    payment: PremiumCreate,
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    week_start = date.today()
    week_end   = week_start + timedelta(days=6)

    new_payment = PremiumPayment(
        user_id          = current_user.id,       # from JWT
        policy_id        = payment.policy_id,
        base_amount      = payment.amount,         # what user pays
        final_amount     = payment.amount,         # same unless risk-adjusted
        payment_method   = payment.payment_method,
        transaction_id   = f"TXN-{uuid.uuid4().hex[:10].upper()}",
        status           = "paid",
        week_start       = week_start,
        week_end         = week_end,
    )
    db.add(new_payment)
    db.commit()
    db.refresh(new_payment)
    return new_payment