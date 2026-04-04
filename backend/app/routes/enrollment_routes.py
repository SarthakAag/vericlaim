from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from app.database import SessionLocal
from app.models.enrollment_model import PolicyEnrollment
from app.models.policy_model import InsurancePolicy
from app.models.user_model import DeliveryPartner
from app.schemas.enrollment_schema import EnrollmentCreate, EnrollmentResponse
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
    db: Session = Depends(get_db)
) -> DeliveryPartner:
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    # ── FIX: auth.py stores "user_id" and "email", NOT "sub" ─────────────────
    user_id: int = payload.get("user_id")
    if not user_id:
        # fallback: some older tokens may use "sub" as email
        email = payload.get("sub") or payload.get("email")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        user = db.query(DeliveryPartner).filter(DeliveryPartner.email == email).first()
    else:
        user = db.query(DeliveryPartner).filter(DeliveryPartner.id == user_id).first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ── ENROLL ────────────────────────────────────────────────────────────────────
@router.post("/enroll", response_model=EnrollmentResponse)
def enroll_policy(
    enrollment: EnrollmentCreate,
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # 1. Policy must exist and be active
    policy = db.query(InsurancePolicy).filter(
        InsurancePolicy.id == enrollment.policy_id,
        InsurancePolicy.is_active == True,
    ).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found or inactive")

    # 2. Block duplicate active enrollment in the same policy
    existing = db.query(PolicyEnrollment).filter(
        PolicyEnrollment.user_id  == current_user.id,
        PolicyEnrollment.policy_id == enrollment.policy_id,
        PolicyEnrollment.status   == "active",
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You are already enrolled in this policy")

    # 3. Income eligibility check (optional field)
    if hasattr(current_user, "weekly_income") and current_user.weekly_income is not None:
        if not (policy.min_weekly_income <= current_user.weekly_income <= policy.max_weekly_income):
            raise HTTPException(status_code=400, detail="Your weekly income does not meet eligibility for this policy")

    # 4. Use user's registered zone as home_zone fallback
    home_zone = enrollment.home_zone or getattr(current_user, "zone", None)

    new_enrollment = PolicyEnrollment(
        user_id             = current_user.id,
        policy_id           = policy.id,
        policy_tier         = policy.policy_tier,
        weekly_premium_paid = policy.weekly_premium,
        home_zone           = home_zone,
        auto_renew          = enrollment.auto_renew,
        status              = "active",
    )
    db.add(new_enrollment)
    db.commit()
    db.refresh(new_enrollment)
    return new_enrollment


# ── GET MY ENROLLMENTS — frontend calls GET /enrollment/history ───────────────
@router.get("/history", response_model=list[EnrollmentResponse])
def get_enrollment_history(
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all enrollments for the current user (all statuses).
    Frontend primary call: GET /enrollment/history
    """
    return db.query(PolicyEnrollment).filter(
        PolicyEnrollment.user_id == current_user.id
    ).order_by(PolicyEnrollment.enrolled_at.desc()).all()


# ── GET MY ACTIVE POLICY — frontend fallback: GET /enrollment/my-policy ───────
@router.get("/my-policy", response_model=EnrollmentResponse)
def get_my_active_policy(
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns the current user's single active enrollment.
    Frontend fallback call: GET /enrollment/my-policy
    """
    enrollment = db.query(PolicyEnrollment).filter(
        PolicyEnrollment.user_id == current_user.id,
        PolicyEnrollment.status  == "active",
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="No active enrollment found")
    return enrollment


# ── ALIAS: kept for backward compat ──────────────────────────────────────────
@router.get("/my-enrollments", response_model=list[EnrollmentResponse])
def get_my_enrollments(
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(PolicyEnrollment).filter(
        PolicyEnrollment.user_id == current_user.id
    ).all()


# ── CANCEL ────────────────────────────────────────────────────────────────────
@router.patch("/cancel/{enrollment_id}")
def cancel_enrollment(
    enrollment_id: int,
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    enrollment = db.query(PolicyEnrollment).filter(
        PolicyEnrollment.id      == enrollment_id,
        PolicyEnrollment.user_id == current_user.id,
    ).first()
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    if enrollment.status != "active":
        raise HTTPException(status_code=400, detail=f"Enrollment is already {enrollment.status}")

    enrollment.status = "cancelled"
    db.commit()
    return {"message": "Enrollment cancelled successfully"}


# ── ALL ENROLLMENTS (admin) ───────────────────────────────────────────────────
@router.get("/all")
def get_all_enrollments(db: Session = Depends(get_db)):
    return db.query(PolicyEnrollment).all()