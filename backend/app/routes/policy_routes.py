from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.policy_model import InsurancePolicy
from app.schemas.policy_schema import PolicyCreate
from app.dependencies.admin_auth import get_current_admin

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ADMIN CREATE POLICY
@router.post("/create")
def create_policy(
    policy: PolicyCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin)
):

    new_policy = InsurancePolicy(
        policy_name=policy.policy_name,
        coverage_amount=policy.coverage_amount,
        weekly_premium=policy.weekly_premium,
        description=policy.description
    )

    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)

    return {
        "message": "Policy created successfully",
        "created_by": admin.username
    }


# GET ALL POLICIES
@router.get("/all")
def get_policies(db: Session = Depends(get_db)):

    policies = db.query(InsurancePolicy).all()

    return policies


# SEARCH POLICY BY NAME
@router.get("/search")
def search_policy(name: str, db: Session = Depends(get_db)):

    policies = db.query(InsurancePolicy).filter(
        InsurancePolicy.policy_name.ilike(f"%{name}%")
    ).all()

    return policies