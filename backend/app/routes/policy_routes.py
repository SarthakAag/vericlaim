from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.policy_model import InsurancePolicy
from app.schemas.policy_schema import PolicyCreate, PolicyUpdate, PolicyResponse
from app.dependencies.admin_auth import get_current_admin

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ADMIN — CREATE POLICY
@router.post("/create", response_model=PolicyResponse)
def create_policy(
    policy: PolicyCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin)
):
    if db.query(InsurancePolicy).filter(InsurancePolicy.policy_tier == policy.policy_tier).first():
        raise HTTPException(status_code=400, detail=f"Policy tier '{policy.policy_tier}' already exists")

    new_policy = InsurancePolicy(**policy.model_dump())
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)

    return new_policy


# GET ALL POLICIES
@router.get("/all", response_model=list[PolicyResponse])
def get_policies(
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(InsurancePolicy)
    if active_only:
        query = query.filter(InsurancePolicy.is_active == True)
    return query.all()


# GET POLICY BY ID
@router.get("/{policy_id}", response_model=PolicyResponse)
def get_policy(policy_id: int, db: Session = Depends(get_db)):
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


# SEARCH POLICY BY NAME
@router.get("/search", response_model=list[PolicyResponse])
def search_policy(name: str, db: Session = Depends(get_db)):
    return db.query(InsurancePolicy).filter(
        InsurancePolicy.policy_name.ilike(f"%{name}%")
    ).all()


# ADMIN — UPDATE POLICY
@router.patch("/{policy_id}", response_model=PolicyResponse)
def update_policy(
    policy_id: int,
    updates: PolicyUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin)
):
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(policy, field, value)

    db.commit()
    db.refresh(policy)
    return policy


# ADMIN — DELETE (deactivate) POLICY
@router.delete("/{policy_id}")
def deactivate_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin)
):
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    policy.is_active = False
    db.commit()
    return {"message": f"Policy '{policy.policy_name}' deactivated successfully"}