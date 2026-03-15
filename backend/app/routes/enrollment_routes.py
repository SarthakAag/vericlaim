from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer

from app.database import SessionLocal
from app.models.enrollment_model import PolicyEnrollment
from app.models.policy_model import InsurancePolicy
from app.schemas.enrollment_schema import EnrollmentCreate
from app.utils.jwt_handler import decode_access_token

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/enroll")
def enroll_policy(
    enrollment: EnrollmentCreate,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_id = payload.get("user_id")

    policy = db.query(InsurancePolicy).filter(
        InsurancePolicy.policy_name == enrollment.policy_name
    ).first()

    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    new_enrollment = PolicyEnrollment(
        user_id=user_id,
        policy_id=policy.id
    )

    db.add(new_enrollment)
    db.commit()

    return {
        "message": "Policy enrolled successfully",
        "policy": policy.policy_name
    }