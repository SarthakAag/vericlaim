from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi.security import OAuth2PasswordRequestForm
from datetime import date, timedelta
from typing import Optional

from app.database import SessionLocal
from app.models.admin_model import Admin
from app.models.payout_model import PayoutRecord
from app.schemas.admin_schema import AdminRegister
from app.utils.security import hash_password, verify_password
from app.utils.jwt_handler import create_access_token
from app.dependencies.admin_auth import get_current_admin

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── ADMIN REGISTER ────────────────────────────────────────────────────────────
@router.post("/register")
def admin_register(admin: AdminRegister, db: Session = Depends(get_db)):
    existing_admin = db.query(Admin).filter(Admin.username == admin.username).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin already exists")

    new_admin = Admin(
        full_name=admin.full_name,
        email=admin.email,
        username=admin.username,
        password_hash=hash_password(admin.password)
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return {"message": "Admin registered successfully"}


# ── ADMIN LOGIN ───────────────────────────────────────────────────────────────
@router.post("/login")
def admin_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    db_admin = db.query(Admin).filter(Admin.username == form_data.username).first()
    if not db_admin or not verify_password(form_data.password, db_admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(
        data={"sub": db_admin.username, "role": "admin"}
    )
    return {"access_token": access_token, "token_type": "bearer"}


# ══════════════════════════════════════════════════════════════════════════════
# FRAUD ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

# ── GET /admin/fraud/stats ────────────────────────────────────────────────────
@router.get("/fraud/stats")
def get_fraud_stats(
    db:    Session = Depends(get_db),
    admin = Depends(get_current_admin),
):
    """
    Summary fraud stats for the admin dashboard header cards.
    Queries PayoutRecord table — no extra tables needed.
    """
    total_claims = db.query(func.count(PayoutRecord.id)).scalar() or 0

    high_risk_blocked = (
        db.query(func.count(PayoutRecord.id))
        .filter(PayoutRecord.fraud_risk_level == "high")
        .scalar() or 0
    )

    medium_risk_held = (
        db.query(func.count(PayoutRecord.id))
        .filter(
            PayoutRecord.fraud_risk_level    == "medium",
            PayoutRecord.manual_review_required == True,
        )
        .scalar() or 0
    )

    low_risk_approved = (
        db.query(func.count(PayoutRecord.id))
        .filter(PayoutRecord.fraud_risk_level == "low")
        .scalar() or 0
    )

    # Total INR saved = sum of tentative payouts on rejected/held records
    # We use final_payout_inr = 0 on blocked records, so we approximate
    # by counting high-risk records × avg approved payout
    avg_approved = (
        db.query(func.avg(PayoutRecord.final_payout_inr))
        .filter(PayoutRecord.status == "approved")
        .scalar() or 0.0
    )
    total_saved_inr = round(float(avg_approved) * high_risk_blocked, 2)

    fraud_rate_pct = (
        round((high_risk_blocked + medium_risk_held) / total_claims * 100, 1)
        if total_claims > 0 else 0.0
    )

    # Most common fraud flag across all records
    all_flags: list[str] = []
    records = db.query(PayoutRecord.fraud_flags).filter(
        PayoutRecord.fraud_flags != None
    ).all()
    for (flags,) in records:
        if isinstance(flags, list):
            all_flags.extend(flags)

    top_flag = ""
    if all_flags:
        from collections import Counter
        top_flag = Counter(all_flags).most_common(1)[0][0]

    return {
        "total_claims":       total_claims,
        "high_risk_blocked":  high_risk_blocked,
        "medium_risk_held":   medium_risk_held,
        "low_risk_approved":  low_risk_approved,
        "total_saved_inr":    total_saved_inr,
        "fraud_rate_pct":     fraud_rate_pct,
        "top_flag":           top_flag,
    }


# ── GET /admin/fraud/cases ────────────────────────────────────────────────────
@router.get("/fraud/cases")
def get_fraud_cases(
    risk_level: Optional[str] = None,   # "high" | "medium" | "low"
    limit:      int           = 50,
    db:         Session       = Depends(get_db),
    admin                     = Depends(get_current_admin),
):
    """
    Returns flagged payout records for the fraud case list.
    Optionally filter by risk_level.
    """
    query = db.query(PayoutRecord).filter(
        PayoutRecord.fraud_risk_level.in_(["high", "medium"])
    )

    if risk_level:
        query = query.filter(PayoutRecord.fraud_risk_level == risk_level.lower())

    records = (
        query.order_by(PayoutRecord.id.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id":                     r.id,
            "payout_reference":       r.payout_reference,
            "user_id":                r.user_id,
            "disruption_type":        r.disruption_type,
            "fraud_risk_level":       r.fraud_risk_level,
            "fraud_score":            r.fraud_score or 0,
            "fraud_flags":            r.fraud_flags or [],
            "status":                 r.status,
            "final_payout_inr":       r.final_payout_inr or 0,
            "manual_review_required": r.manual_review_required or False,
            "created_at":             r.id,   # use actual timestamp if column exists
            "location":               None,   # add if PayoutRecord has location col
        }
        for r in records
    ]


# ── PATCH /admin/fraud/{record_id}/approve ────────────────────────────────────
@router.patch("/fraud/{record_id}/approve")
def approve_fraud_case(
    record_id: int,
    db:        Session = Depends(get_db),
    admin                = Depends(get_current_admin),
):
    """
    Manually approve a held (medium-risk) payout after review.
    Sets status → approved and clears manual_review_required.
    """
    record = db.query(PayoutRecord).filter(PayoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payout record not found")

    if record.fraud_risk_level == "high":
        raise HTTPException(
            status_code=400,
            detail="High-risk records cannot be manually approved"
        )

    record.status                 = "approved"
    record.manual_review_required = False
    db.commit()
    db.refresh(record)

    return {
        "message":   f"Record {record_id} approved",
        "status":    record.status,
        "record_id": record_id,
    }


# ── PATCH /admin/fraud/{record_id}/reject ─────────────────────────────────────
@router.patch("/fraud/{record_id}/reject")
def reject_fraud_case(
    record_id: int,
    db:        Session = Depends(get_db),
    admin                = Depends(get_current_admin),
):
    """
    Manually reject a held (medium-risk) payout after review.
    Sets status → rejected and clears manual_review_required.
    """
    record = db.query(PayoutRecord).filter(PayoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payout record not found")

    record.status                 = "rejected"
    record.rejection_reason       = "MANUAL_REVIEW_REJECTED_BY_ADMIN"
    record.manual_review_required = False
    db.commit()
    db.refresh(record)

    return {
        "message":   f"Record {record_id} rejected",
        "status":    record.status,
        "record_id": record_id,
    }