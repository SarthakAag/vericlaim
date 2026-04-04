from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.policy_model import InsurancePolicy
from app.schemas.policy_schema import PolicyCreate, PolicyUpdate, PolicyResponse
from app.dependencies.admin_auth import get_current_admin
from app.core.exclusions import exclusions_for_frontend

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── ADMIN: CREATE ─────────────────────────────────────────────────────────────
@router.post("/create", response_model=PolicyResponse)
def create_policy(
    policy: PolicyCreate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    if db.query(InsurancePolicy).filter(InsurancePolicy.policy_tier == policy.policy_tier).first():
        raise HTTPException(status_code=400, detail=f"Policy tier '{policy.policy_tier}' already exists")

    new_policy = InsurancePolicy(**policy.model_dump())
    db.add(new_policy)
    db.commit()
    db.refresh(new_policy)
    return new_policy


# ── GET ALL ───────────────────────────────────────────────────────────────────
@router.get("/all", response_model=list[PolicyResponse])
def get_policies(
    active_only: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(InsurancePolicy)
    if active_only:
        query = query.filter(InsurancePolicy.is_active == True)
    return query.all()


# ── EXCLUSIONS (public) ───────────────────────────────────────────────────────
# IMPORTANT: must be defined BEFORE /{policy_id} or FastAPI will try to
# cast "exclusions" as an int and return 422 instead of reaching this route.
@router.get("/exclusions")
def get_exclusions():
    """
    Returns the full exclusion clause list for frontend display
    and onboarding acknowledgement. Grouped by category.
    """
    all_ex  = exclusions_for_frontend()
    grouped = {}
    for ex in all_ex:
        grouped.setdefault(ex["category"], []).append(ex)
    return {
        "total":   len(all_ex),
        "grouped": grouped,
        "flat":    all_ex,
        "note": (
            "GigShield covers INCOME LOSS from external disruptions ONLY. "
            "Health, life, accidents, and vehicle repairs are strictly excluded "
            "as per IRDAI guidelines and platform rules."
        ),
    }


# ── SEARCH BY NAME ────────────────────────────────────────────────────────────
# IMPORTANT: must also be before /{policy_id} for the same reason.
@router.get("/search", response_model=list[PolicyResponse])
def search_policy(name: str, db: Session = Depends(get_db)):
    return db.query(InsurancePolicy).filter(
        InsurancePolicy.policy_name.ilike(f"%{name}%")
    ).all()


# ── GET BY ID ─────────────────────────────────────────────────────────────────
# All literal-path routes (/all, /exclusions, /search) must come before this.
@router.get("/{policy_id}", response_model=PolicyResponse)
def get_policy(policy_id: int, db: Session = Depends(get_db)):
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


# ── ADMIN: UPDATE ─────────────────────────────────────────────────────────────
@router.patch("/{policy_id}", response_model=PolicyResponse)
def update_policy(
    policy_id: int,
    updates: PolicyUpdate,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    for field, value in updates.model_dump(exclude_unset=True).items():
        setattr(policy, field, value)

    db.commit()
    db.refresh(policy)
    return policy


# ── ADMIN: DELETE (soft deactivate) ──────────────────────────────────────────
@router.delete("/{policy_id}")
def deactivate_policy(
    policy_id: int,
    db: Session = Depends(get_db),
    admin=Depends(get_current_admin),
):
    policy = db.query(InsurancePolicy).filter(InsurancePolicy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")

    policy.is_active = False
    db.commit()
    return {"message": f"Policy '{policy.policy_name}' deactivated successfully"}