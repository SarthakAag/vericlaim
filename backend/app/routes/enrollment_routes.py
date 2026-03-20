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
):
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    # token stores email/username in "sub" — look up actual user
    email: str = payload.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(DeliveryPartner).filter(DeliveryPartner.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


# ENROLL IN POLICY
@router.post("/enroll", response_model=EnrollmentResponse)
def enroll_policy(
    enrollment: EnrollmentCreate,
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Check policy exists and is active
    policy = db.query(InsurancePolicy).filter(
        InsurancePolicy.id == enrollment.policy_id,
        InsurancePolicy.is_active == True
    ).first()

    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found or inactive")

    # 2. Check if user already has an ACTIVE enrollment in this specific policy
    existing = db.query(PolicyEnrollment).filter(
        PolicyEnrollment.user_id == current_user.id,
        PolicyEnrollment.policy_id == enrollment.policy_id,
        PolicyEnrollment.status == "active"           # ← only block active duplicates
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You are already enrolled in this policy"
        )

    # 3. Check user income eligibility
    if hasattr(current_user, "weekly_income") and current_user.weekly_income is not None:
        if not (policy.min_weekly_income <= current_user.weekly_income <= policy.max_weekly_income):
            raise HTTPException(
                status_code=400,
                detail=f"Your weekly income does not meet eligibility for this policy"
            )

    # 4. Create enrollment with full snapshot from policy
    new_enrollment = PolicyEnrollment(
        user_id=current_user.id,
        policy_id=policy.id,
        policy_tier=policy.policy_tier,              # snapshot tier at enrollment time
        weekly_premium_paid=policy.weekly_premium,   # snapshot premium at enrollment time
        home_zone=enrollment.home_zone,
        auto_renew=enrollment.auto_renew,
        status="active",
    )

    db.add(new_enrollment)
    db.commit()
    db.refresh(new_enrollment)

    return new_enrollment


# GET MY ENROLLMENTS
@router.get("/my-enrollments", response_model=list[EnrollmentResponse])
def get_my_enrollments(
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollments = db.query(PolicyEnrollment).filter(
        PolicyEnrollment.user_id == current_user.id
    ).all()

    return enrollments


# CANCEL ENROLLMENT
@router.patch("/cancel/{enrollment_id}")
def cancel_enrollment(
    enrollment_id: int,
    current_user: DeliveryPartner = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    enrollment = db.query(PolicyEnrollment).filter(
        PolicyEnrollment.id == enrollment_id,
        PolicyEnrollment.user_id == current_user.id   # user can only cancel their own
    ).first()

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if enrollment.status != "active":
        raise HTTPException(status_code=400, detail=f"Enrollment is already {enrollment.status}")

    enrollment.status = "cancelled"
    db.commit()

    return {"message": "Enrollment cancelled successfully"}


# GET ALL ENROLLMENTS (admin)
@router.get("/all")
def get_all_enrollments(db: Session = Depends(get_db)):
    return db.query(PolicyEnrollment).all()