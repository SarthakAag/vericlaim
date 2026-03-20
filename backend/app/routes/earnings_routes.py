from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

import random
from datetime import datetime, date, timedelta

from app.utils.chennai_locations import chennai_locations
from app.database import SessionLocal
from app.models.earnings_model import DeliveryEarnings
from app.models.enrollment_model import PolicyEnrollment
from app.models.policy_model import InsurancePolicy
from app.utils.jwt_handler import decode_access_token

from app.services.weather_service import get_weather
from app.services.traffic_service import get_traffic
from app.services.location_service import calculate_speed
from app.services.ml_risk_model import get_model

# Pre-load ML model at startup so first request isn't slow
_ml_model = get_model()

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Weather string → ML-compatible dict ──────────────────────────────────────
def build_weather_dict(weather_str: str) -> dict:
    month = datetime.now().month

    TEMP = {1:26,2:28,3:31,4:34,5:38,6:36,7:33,8:32,9:31,10:29,11:27,12:26}
    AQI  = {1:90,2:85,3:90,4:110,5:130,6:80,7:70,8:75,9:80,10:95,11:105,12:95}

    base_temp = TEMP.get(month, 30)
    base_aqi  = AQI.get(month, 90)

    if weather_str == "rain":
        rain_mm = random.uniform(35, 75) if month in (6,7,8,9,10,11) \
                  else random.uniform(15, 40)
        return {
            "condition":      "rain",
            "rain_mm_per_hr": round(rain_mm, 1),
            "wind_kmh":       round(random.uniform(15, 35), 1),
            "temperature_c":  round(base_temp - random.uniform(2, 5), 1),
            "aqi":            max(50, base_aqi - random.randint(10, 20)),
            "visibility_m":   round(max(200, 5000 - rain_mm * 60), 0),
            "humidity":       random.randint(80, 95),
        }
    else:
        return {
            "condition":      "clear",
            "rain_mm_per_hr": round(random.uniform(0, 3), 1),
            "wind_kmh":       round(random.uniform(5, 18), 1),
            "temperature_c":  round(base_temp + random.uniform(-1, 2), 1),
            "aqi":            base_aqi + random.randint(-15, 25),
            "visibility_m":   round(random.uniform(6000, 10000), 0),
            "humidity":       random.randint(55, 75),
        }


TRAFFIC_TO_INT  = {"low":0,"normal":0,"moderate":1,"heavy":2,"gridlock":3}
TRAFFIC_DELAY   = {"low":5,"normal":5,"moderate":15,"heavy":35,"gridlock":60}

# Chennai zone flood risk
_ZONE_RISK = {
    "velachery":0.90,"adyar":0.85,"madipakkam":0.82,"perungudi":0.80,
    "sholinganallur":0.78,"porur":0.75,"tambaram":0.70,"chromepet":0.60,
    "kodambakkam":0.65,"perambur":0.55,"ambattur":0.58,"pallikaranai":0.72,
    "medavakkam":0.68,"t_nagar":0.50,"anna_nagar":0.40,
    "nungambakkam":0.42,"mylapore":0.48,"guindy":0.44,
}

def _zone_risk(zone: str) -> float:
    return _ZONE_RISK.get(zone.lower().replace(" ","_"), 0.50)


# ── COMPLETE DELIVERY ─────────────────────────────────────────────────────────
@router.post("/complete-delivery")
def complete_delivery(
    deliveries:    int,
    distance_km:   float,
    lat:           float,
    lon:           float,
    late_delivery: bool,
    token:         str     = Depends(oauth2_scheme),
    db:            Session = Depends(get_db)
):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not found in token")

    # ── Base earnings ─────────────────────────────────────────────────────────
    base_earnings = (deliveries * 30) + (distance_km * 8)

    # ── Random Chennai location ───────────────────────────────────────────────
    location     = random.choice(chennai_locations)
    lat, lon     = location["lat"], location["lon"]
    area         = location["area"]
    zone         = area.lower().replace(" ", "_")

    # ── Weather (FIX 1: force "rain" ~40% of the time for demo if API unavailable) ──
    try:
        weather_str = get_weather(lat, lon)
    except Exception:
        weather_str = "normal"

    # If weather API has no key it always returns "normal" which gives 0 bonus.
    # For realistic demo: randomly simulate rain based on current month.
    if weather_str == "normal":
        month = datetime.now().month
        # Higher rain probability in monsoon months (Jun–Nov)
        rain_prob = 0.60 if month in (6,7,8,9,10,11) else 0.25
        if random.random() < rain_prob:
            weather_str = "rain"

    # ── Traffic ───────────────────────────────────────────────────────────────
    try:
        traffic_str = get_traffic()
    except Exception:
        traffic_str = "normal"

    # ── Build ML inputs ───────────────────────────────────────────────────────
    weather_dict   = build_weather_dict(weather_str)
    congestion_int = TRAFFIC_TO_INT.get(traffic_str.lower(), 1)
    traffic_delay  = TRAFFIC_DELAY.get(traffic_str.lower(), 15)
    now            = datetime.now()
    driver_speed   = calculate_speed(distance_km, 20)

    # ── Run ML model ──────────────────────────────────────────────────────────
    ml_result = _ml_model.predict(
        rain_mm_per_hr     = weather_dict["rain_mm_per_hr"],
        temperature_c      = weather_dict["temperature_c"],
        aqi                = int(weather_dict["aqi"]),
        wind_kmh           = weather_dict["wind_kmh"],
        visibility_m       = weather_dict["visibility_m"],
        zone_flood_risk    = _zone_risk(zone),
        congestion         = congestion_int,
        traffic_delay_min  = traffic_delay,
        road_closure       = 0,
        driver_speed       = driver_speed,
        hist_avg_speed     = 22.0,
        distance_remaining = distance_km,
        hour               = now.hour,
        weekday            = now.weekday(),
        month              = now.month,
        # FIX 2: Don't pass db here — avoids week_start column crash on old DB schema
        # Prediction history write is optional; skip it until DB is migrated
    )

    risk_score    = ml_result.get("risk_score", 0)
    delay_level   = ml_result.get("delay_level", "low")
    extra_minutes = ml_result.get("extra_minutes", 0)
    parametric    = ml_result.get("parametric_trigger", {})
    trigger_fired = parametric.get("triggered", False)
    trigger_type  = parametric.get("trigger_type")
    auto_claim_ok = parametric.get("auto_claim_eligible", False)

    # ── Bonuses ───────────────────────────────────────────────────────────────
    weather_bonus    = 0
    traffic_bonus    = 0
    late_penalty     = 0
    ai_delay_bonus   = 0
    insurance_payout = 0

    if traffic_str == "heavy":
        traffic_bonus = 40
    elif traffic_str == "moderate":
        traffic_bonus = 20

    if ml_result.get("delay_detected"):
        ai_delay_bonus = extra_minutes * 2

    # ── Policy check ──────────────────────────────────────────────────────────
    enrollment = db.query(PolicyEnrollment).filter(
        PolicyEnrollment.user_id == user_id,
    ).first()

    if enrollment:
        policy = db.query(InsurancePolicy).filter(
            InsurancePolicy.id == enrollment.policy_id
        ).first()

        if policy:
            # Weather bonus: fires on rain, ML risk-proportional
            # (FIX 1: no longer requires late_delivery or nonexistent fields)
            if weather_str == "rain":
                max_bonus     = float(policy.coverage_amount or 0) * 0.05
                weather_bonus = round(min(risk_score * 0.5, max_bonus), 2)

            # Parametric insurance payout
            if trigger_fired and auto_claim_ok:
                week_start      = date.today() - timedelta(days=date.today().weekday())
                paid_this_week  = _get_paid_this_week(db, user_id, week_start)
                # FIX 2: use coverage_amount as fallback cap (max_weekly_payout may not exist)
                payout_cap = (
                    float(getattr(policy, "max_weekly_payout", None) or policy.coverage_amount or 1200)
                )
                remaining_cap = payout_cap - paid_this_week

                if remaining_cap > 0:
                    # Estimate hourly income from recent delivery records
                    weekly_income  = _get_weekly_avg_income_safe(db, user_id)
                    hourly_rate    = weekly_income / 60
                    coverage_hours = parametric.get("coverage_hours", 1)
                    income_pct     = float(getattr(policy, "income_covered_pct", None) or 0.70)
                    raw_payout     = hourly_rate * income_pct * coverage_hours
                    insurance_payout = round(min(raw_payout, remaining_cap), 2)

                    # Save payout record (non-fatal)
                    _save_payout_safe(
                        db, user_id,
                        getattr(enrollment, "id", None),
                        policy.id,
                        trigger_type, insurance_payout, week_start,
                    )

    # ── Late penalty ──────────────────────────────────────────────────────────
    if late_delivery and weather_str == "normal" and traffic_str == "normal":
        late_penalty = 20

    # ── Final earnings ────────────────────────────────────────────────────────
    total_earnings = (
        base_earnings + weather_bonus + traffic_bonus + ai_delay_bonus - late_penalty
    )

    # ── Save to DB (FIX 3: only save columns that exist in old schema) ─────────
    try:
        new_record = DeliveryEarnings(
            user_id              = user_id,
            deliveries_completed = deliveries,
            distance_travelled   = distance_km,
            weather_bonus        = weather_bonus,
            traffic_bonus        = traffic_bonus,
            total_earnings       = total_earnings,
        )
        # Try to set new ML columns — silently skip if they don't exist in DB yet
        for col, val in [
            ("insurance_bonus",    insurance_payout),
            ("disruption_type",    trigger_type),
            ("payout_received_inr",insurance_payout),
        ]:
            try:
                setattr(new_record, col, val)
            except Exception:
                pass

        db.add(new_record)
        db.commit()
        db.refresh(new_record)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"DB save failed: {str(e)}")

    return {
        "message":              "Delivery recorded successfully",
        "area":                 area,
        "weather":              weather_str,
        "traffic":              traffic_str,
        "base_earnings":        round(base_earnings, 2),
        "weather_bonus":        weather_bonus,
        "traffic_bonus":        traffic_bonus,
        "ai_delay_bonus":       ai_delay_bonus,
        "late_penalty":         late_penalty,
        "final_total_earnings": round(total_earnings, 2),
        # ML outputs
        "risk_score":           round(risk_score, 1),
        "delay_level":          delay_level,
        "trigger_type":         trigger_type,
        "payout_amount":        insurance_payout,
        "ml_details": {
            "extra_minutes":  extra_minutes,
            "trigger_fired":  trigger_fired,
            "auto_claim":     auto_claim_ok,
            "flags":          ml_result.get("flags", []),
            "weather_inputs": {
                "rain_mm_per_hr": weather_dict["rain_mm_per_hr"],
                "temperature_c":  weather_dict["temperature_c"],
                "aqi":            weather_dict["aqi"],
            },
        },
    }


# ── TOTAL EARNINGS ────────────────────────────────────────────────────────────
@router.get("/total")
def total_earnings(
    token: str     = Depends(oauth2_scheme),
    db:    Session = Depends(get_db)
):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("user_id")
    records = db.query(DeliveryEarnings).filter(
        DeliveryEarnings.user_id == user_id
    ).all()
    total = sum(r.total_earnings or 0 for r in records)
    return {"total_earnings": total, "delivery_records": len(records)}


# ── EARNINGS HISTORY ──────────────────────────────────────────────────────────
@router.get("/history")
def earnings_history(
    token: str     = Depends(oauth2_scheme),
    db:    Session = Depends(get_db)
):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = payload.get("user_id")
    records = db.query(DeliveryEarnings).filter(
        DeliveryEarnings.user_id == user_id
    ).all()
    return records


# ══════════════════════════════════════════════════════════════════════════════
# SAFE HELPERS — won't crash on old DB schema
# ══════════════════════════════════════════════════════════════════════════════

def _get_weekly_avg_income_safe(db: Session, user_id: int) -> float:
    """
    FIX 2: Old earnings_model has NO week_start column.
    Query without week_start filter — just average all records.
    """
    try:
        from sqlalchemy import func
        result = (
            db.query(func.avg(DeliveryEarnings.total_earnings))
            .filter(DeliveryEarnings.user_id == user_id)
            .scalar()
        )
        val = float(result) if result else 0.0
        return val if val > 100 else 4_000.0   # sensible minimum
    except Exception:
        return 4_000.0


def _get_paid_this_week(db: Session, user_id: int, week_start: date) -> float:
    """Sum approved payouts this week from payout_records table."""
    try:
        from sqlalchemy import func
        from app.models.payout_model import PayoutRecord
        result = (
            db.query(func.coalesce(func.sum(PayoutRecord.final_payout_inr), 0.0))
            .filter(
                PayoutRecord.user_id    == user_id,
                PayoutRecord.status     == "approved",
                PayoutRecord.week_start == week_start,
            )
            .scalar()
        )
        return float(result or 0)
    except Exception:
        return 0.0


def _save_payout_safe(
    db:            Session,
    user_id:       int,
    enrollment_id,
    policy_id:     int,
    trigger_type,
    amount:        float,
    week_start:    date,
) -> None:
    """Write PayoutRecord — fully non-fatal, won't break delivery flow."""
    try:
        from app.models.payout_model import PayoutRecord
        ts  = datetime.utcnow()
        ref = f"PAY-{str(user_id).zfill(6)}-{ts.strftime('%Y%m%d%H%M%S')}"
        rec = PayoutRecord(
            user_id          = user_id,
            policy_id        = policy_id,
            enrollment_id    = enrollment_id,
            payout_reference = ref,
            week_start       = week_start,
            disruption_type  = trigger_type,
            trigger_type     = trigger_type,
            final_payout_inr = amount,
            status           = "approved",
            fraud_risk_level = "low",
            fraud_flags      = [],
            payment_channel  = "UPI_INSTANT" if amount <= 200 else "IMPS",
            paid_at          = ts,
        )
        db.add(rec)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[PayoutRecord] Non-fatal save error: {e}")