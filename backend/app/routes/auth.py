from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user_model import DeliveryPartner
from app.schemas.user_schema import RegisterUser, LoginUser
from app.utils.security import hash_password, verify_password
from app.utils.jwt_handler import create_access_token

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------- REGISTER ----------------
@router.post("/register")
def register(user: RegisterUser, db: Session = Depends(get_db)):

    hashed_pw = hash_password(user.password)

    new_user = DeliveryPartner(
        full_name=user.full_name,
        delivery_partner_id=user.delivery_partner_id,
        email=user.email,
        password_hash=hashed_pw,
        platform=user.platform,
        age=user.age
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully"}


# ---------------- LOGIN ----------------
@router.post("/login")
def login(user: LoginUser, db: Session = Depends(get_db)):

    db_user = db.query(DeliveryPartner).filter(
        DeliveryPartner.email == user.email
    ).first()

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    # CREATE JWT TOKEN
    access_token = create_access_token(
        data={
            "user_id": db_user.id,
            "email": db_user.email
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }