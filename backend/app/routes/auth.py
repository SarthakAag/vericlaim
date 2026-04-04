from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user_model import DeliveryPartner
from app.schemas.user_schema import RegisterUser, LoginUser
from app.utils.security import hash_password, verify_password
from app.utils.jwt_handler import create_access_token, decode_access_token

router = APIRouter()

# ── Zone income profiles (mirrors ml_risk_model.py) ──────────────────────────
FOOD_DELIVERY_ZONE_PROFILE = {
    "velachery":   {"avg_daily_orders": 18, "avg_order_value": 280},
    "adyar":       {"avg_daily_orders": 20, "avg_order_value": 380},
    "t_nagar":     {"avg_daily_orders": 22, "avg_order_value": 350},
    "omr":         {"avg_daily_orders": 15, "avg_order_value": 420},
    "anna_nagar":  {"avg_daily_orders": 20, "avg_order_value": 310},
    "porur":       {"avg_daily_orders": 14, "avg_order_value": 260},
    "tambaram":    {"avg_daily_orders": 16, "avg_order_value": 240},
    "chromepet":   {"avg_daily_orders": 13, "avg_order_value": 220},
    "kodambakkam": {"avg_daily_orders": 15, "avg_order_value": 270},
    "perambur":    {"avg_daily_orders": 12, "avg_order_value": 210},
    "guindy":      {"avg_daily_orders": 16, "avg_order_value": 290},
    "default":     {"avg_daily_orders": 15, "avg_order_value": 280},
}


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_from_token(authorization: str, db: Session) -> DeliveryPartner:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")
    token   = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.query(DeliveryPartner).filter(
        DeliveryPartner.id == payload.get("user_id")
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


def _zone_income(zone: str) -> dict:
    """Return avg orders, order value, and estimated incomes for a zone."""
    profile = FOOD_DELIVERY_ZONE_PROFILE.get(
        (zone or "default").lower(),
        FOOD_DELIVERY_ZONE_PROFILE["default"]
    )
    daily  = round(profile["avg_daily_orders"] * profile["avg_order_value"] * 0.08, 2)
    weekly = round(daily * 6, 2)
    return {
        "avg_daily_orders":  profile["avg_daily_orders"],
        "avg_order_value":   profile["avg_order_value"],
        "est_daily_income":  daily,
        "est_weekly_income": weekly,
    }


# ── REGISTER ──────────────────────────────────────────────────────────────────
@router.post("/register")
def register(user: RegisterUser, db: Session = Depends(get_db)):
    hashed_pw = hash_password(user.password)
    new_user  = DeliveryPartner(
        full_name           = user.full_name,
        delivery_partner_id = user.delivery_partner_id,
        email               = user.email,
        password_hash       = hashed_pw,
        platform            = user.platform,
        age                 = user.age,
        zone                = user.zone,
        vehicle_type        = user.vehicle_type,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return {"message": "User registered successfully"}


# ── LOGIN ─────────────────────────────────────────────────────────────────────
@router.post("/login")
def login(user: LoginUser, db: Session = Depends(get_db)):
    db_user = db.query(DeliveryPartner).filter(
        DeliveryPartner.email == user.email
    ).first()

    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password")

    access_token = create_access_token(
        data={"user_id": db_user.id, "email": db_user.email}
    )

    return {
        "access_token": access_token,
        "token_type":   "bearer",
        "platform":     db_user.platform,  # navbar badge uses this
        "zone":         db_user.zone,       # optional, for early localStorage sync
    }


# ── ME ────────────────────────────────────────────────────────────────────────
@router.get("/me")
def me(
    authorization: str = Header(default=None),
    db: Session = Depends(get_db),
):
    """
    Returns full user profile enriched with zone-based income estimates.
    Called by EarningsDashboard to populate the persona banner.
    """
    db_user = _get_user_from_token(authorization, db)
    income  = _zone_income(db_user.zone)

    return {
        "id":                  db_user.id,
        "full_name":           db_user.full_name,
        "email":               db_user.email,
        "platform":            db_user.platform,
        "zone":                db_user.zone,
        "vehicle_type":        db_user.vehicle_type,
        "age":                 db_user.age,
        "delivery_partner_id": db_user.delivery_partner_id,
        # ── Zone income estimates (used by EarningsDashboard persona banner) ──
        "avg_daily_orders":    income["avg_daily_orders"],
        "avg_order_value":     income["avg_order_value"],
        "est_daily_income":    income["est_daily_income"],
        "est_weekly_income":   income["est_weekly_income"],
    }