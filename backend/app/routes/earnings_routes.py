from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from app.database import SessionLocal
from app.models.earnings_model import DeliveryEarnings
from app.models.enrollment_model import PolicyEnrollment
from app.models.policy_model import InsurancePolicy
from app.utils.jwt_handler import decode_access_token

from app.services.weather_service import get_weather
from app.services.traffic_service import get_traffic


router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


# -------------------------
# DATABASE DEPENDENCY
# -------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# -------------------------
# COMPLETE DELIVERY
# -------------------------
@router.post("/complete-delivery")
def complete_delivery(
    deliveries: int,
    distance_km: float,
    lat: float,
    lon: float,
    late_delivery: bool,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")

    # -------------------------
    # BASE EARNINGS
    # -------------------------
    base_pay = 30
    distance_rate = 8

    base_earnings = (deliveries * base_pay) + (distance_km * distance_rate)

    # -------------------------
    # WEATHER DETECTION
    # -------------------------
    weather = get_weather(lat, lon)

    # -------------------------
    # TRAFFIC DETECTION
    # -------------------------
    traffic = get_traffic()

    weather_bonus = 0
    traffic_bonus = 0
    late_penalty = 0

    # -------------------------
    # TRAFFIC BONUS
    # -------------------------
    if traffic == "heavy":
        traffic_bonus = 40
    elif traffic == "moderate":
        traffic_bonus = 20

    # -------------------------
    # POLICY CHECK
    # -------------------------
    enrollment = db.query(PolicyEnrollment).filter(
        PolicyEnrollment.user_id == user_id
    ).first()

    if enrollment:

        policy = db.query(InsurancePolicy).filter(
            InsurancePolicy.id == enrollment.policy_id
        ).first()

        if weather == "rain" and late_delivery and policy.late_delivery_coverage:
            weather_bonus = policy.rain_bonus

    # -------------------------
    # LATE PENALTY
    # -------------------------
    if late_delivery and weather == "normal" and traffic == "normal":
        late_penalty = 20

    # -------------------------
    # FINAL EARNINGS
    # -------------------------
    total_earnings = base_earnings + weather_bonus + traffic_bonus - late_penalty

    # -------------------------
    # SAVE TO DATABASE
    # -------------------------
    new_record = DeliveryEarnings(
        user_id=user_id,
        deliveries_completed=deliveries,
        distance_travelled=distance_km,
        weather_bonus=weather_bonus,
        traffic_bonus=traffic_bonus,
        total_earnings=total_earnings
    )

    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    return {
        "message": "Delivery recorded successfully",
        "weather": weather,
        "traffic": traffic,
        "base_earnings": base_earnings,
        "weather_bonus": weather_bonus,
        "traffic_bonus": traffic_bonus,
        "late_penalty": late_penalty,
        "final_total_earnings": total_earnings
    }


# -------------------------
# TOTAL EARNINGS
# -------------------------
@router.get("/total")
def total_earnings(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")

    records = db.query(DeliveryEarnings).filter(
        DeliveryEarnings.user_id == user_id
    ).all()

    total = sum(r.total_earnings for r in records)

    return {
        "total_earnings": total,
        "delivery_records": len(records)
    }


# -------------------------
# EARNINGS HISTORY
# -------------------------
@router.get("/history")
def earnings_history(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    payload = decode_access_token(token)

    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")

    records = db.query(DeliveryEarnings).filter(
        DeliveryEarnings.user_id == user_id
    ).all()

    return records