from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from fastapi.security import OAuth2PasswordRequestForm
from datetime import date, timedelta, datetime
from typing import Optional

from pydantic import BaseModel

from app.database import SessionLocal
from app.models.admin_model     import Admin
from app.models.payout_model    import PayoutRecord
from app.models.fraud_audit_model import FraudAuditLog
from app.schemas.admin_schema   import AdminRegister
from app.utils.security         import hash_password, verify_password
from app.utils.jwt_handler      import create_access_token
from app.dependencies.admin_auth import get_current_admin

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Request bodies ────────────────────────────────────────────────────────────

class FraudActionRequest(BaseModel):
    notes: Optional[str] = None   # admin notes recorded in audit log


# ── ADMIN REGISTER ────────────────────────────────────────────────────────────
@router.post("/register")
def admin_register(admin: AdminRegister, db: Session = Depends(get_db)):
    existing_admin = db.query(Admin).filter(Admin.username == admin.username).first()
    if existing_admin:
        raise HTTPException(status_code=400, detail="Admin already exists")

    new_admin = Admin(
        full_name     = admin.full_name,
        email         = admin.email,
        username      = admin.username,
        password_hash = hash_password(admin.password)
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)
    return {"message": "Admin registered successfully"}


# ── ADMIN LOGIN ───────────────────────────────────────────────────────────────
@router.post("/login")
def admin_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db:        Session = Depends(get_db)
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
    admin          = Depends(get_current_admin),
):
    total_claims = db.query(func.count(PayoutRecord.id)).scalar() or 0

    high_risk_blocked = (
        db.query(func.count(PayoutRecord.id))
        .filter(PayoutRecord.fraud_risk_level == "high")
        .scalar() or 0
    )
    medium_risk_held = (
        db.query(func.count(PayoutRecord.id))
        .filter(
            PayoutRecord.fraud_risk_level       == "medium",
            PayoutRecord.manual_review_required == True,
        )
        .scalar() or 0
    )
    escalated_count = (
        db.query(func.count(PayoutRecord.id))
        .filter(PayoutRecord.status == "escalated")
        .scalar() or 0
    )
    low_risk_approved = (
        db.query(func.count(PayoutRecord.id))
        .filter(PayoutRecord.fraud_risk_level == "low")
        .scalar() or 0
    )

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

    # Recent audit activity (last 5 actions for the dashboard ticker)
    recent_actions = (
        db.query(FraudAuditLog)
        .order_by(desc(FraudAuditLog.acted_at))
        .limit(5)
        .all()
    )

    return {
        "total_claims":      total_claims,
        "high_risk_blocked": high_risk_blocked,
        "medium_risk_held":  medium_risk_held,
        "escalated_count":   escalated_count,
        "low_risk_approved": low_risk_approved,
        "total_saved_inr":   total_saved_inr,
        "fraud_rate_pct":    fraud_rate_pct,
        "top_flag":          top_flag,
        "recent_actions": [
            {
                "action":         a.action,
                "admin":          a.admin_username,
                "payout_ref":     a.payout_record.payout_reference if a.payout_record else "—",
                "payout_inr":     a.payout_released_inr,
                "notes":          a.notes,
                "acted_at":       a.acted_at.isoformat(),
            }
            for a in recent_actions
        ],
    }


# ── GET /admin/fraud/cases ────────────────────────────────────────────────────
@router.get("/fraud/cases")
def get_fraud_cases(
    risk_level: Optional[str] = None,
    status:     Optional[str] = None,
    limit:      int           = 50,
    db:         Session       = Depends(get_db),
    admin                     = Depends(get_current_admin),
):
    query = db.query(PayoutRecord).filter(
        PayoutRecord.fraud_risk_level.in_(["high", "medium"])
    )
    if risk_level:
        query = query.filter(PayoutRecord.fraud_risk_level == risk_level.lower())
    if status:
        query = query.filter(PayoutRecord.status == status.lower())

    records = query.order_by(desc(PayoutRecord.created_at)).limit(limit).all()

    return [_serialize_case(r) for r in records]


# ── GET /admin/fraud/{record_id}/audit ───────────────────────────────────────
@router.get("/fraud/{record_id}/audit")
def get_fraud_audit_trail(
    record_id: int,
    db:        Session = Depends(get_db),
    admin              = Depends(get_current_admin),
):
    """Full audit trail for a single payout record."""
    logs = (
        db.query(FraudAuditLog)
        .filter(FraudAuditLog.payout_record_id == record_id)
        .order_by(FraudAuditLog.acted_at)
        .all()
    )
    return [
        {
            "id":               l.id,
            "action":           l.action,
            "admin_username":   l.admin_username,
            "previous_status":  l.previous_status,
            "new_status":       l.new_status,
            "notes":            l.notes,
            "payout_released":  l.payout_released_inr,
            "acted_at":         l.acted_at.isoformat(),
        }
        for l in logs
    ]


# ── PATCH /admin/fraud/{record_id}/approve ────────────────────────────────────
@router.patch("/fraud/{record_id}/approve")
def approve_fraud_case(
    record_id: int,
    body:      FraudActionRequest = FraudActionRequest(),
    db:        Session = Depends(get_db),
    admin              = Depends(get_current_admin),
):
    """
    Approve a held (medium-risk) claim after manual review.
    Releases the payout amount from calculation_breakdown if available,
    otherwise uses base_payout_inr.
    Writes an immutable FraudAuditLog row.
    """
    record = db.query(PayoutRecord).filter(PayoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payout record not found")
    if record.fraud_risk_level == "high":
        raise HTTPException(status_code=400, detail="High-risk records cannot be approved")
    if record.status not in ("held_for_review", "escalated"):
        raise HTTPException(status_code=400, detail=f"Cannot approve record with status '{record.status}'")

    previous_status = record.status

    # ── Release payout amount ─────────────────────────────────────────────────
    # For held records the engine stored 0 — recover amount from breakdown
    payout_to_release = 0.0
    if record.calculation_breakdown:
        payout_to_release = (
            record.calculation_breakdown.get("after_cap_inr")
            or record.calculation_breakdown.get("base_payout_inr")
            or 0.0
        )
    if payout_to_release == 0.0 and record.base_payout_inr:
        payout_to_release = record.base_payout_inr

    record.status                 = "approved"
    record.final_payout_inr       = payout_to_release
    record.manual_review_required = False
    record.updated_at             = datetime.utcnow()

    # ── Write audit log ───────────────────────────────────────────────────────
    audit = FraudAuditLog(
        payout_record_id    = record.id,
        user_id             = record.user_id,
        admin_username      = admin.username,
        action              = "approved",
        previous_status     = previous_status,
        new_status          = "approved",
        notes               = body.notes,
        payout_released_inr = payout_to_release,
    )
    db.add(audit)
    db.commit()
    db.refresh(record)

    return {
        "message":            f"Record {record_id} approved",
        "status":             record.status,
        "payout_released_inr": payout_to_release,
        "record_id":          record_id,
    }


# ── PATCH /admin/fraud/{record_id}/reject ─────────────────────────────────────
@router.patch("/fraud/{record_id}/reject")
def reject_fraud_case(
    record_id: int,
    body:      FraudActionRequest = FraudActionRequest(),
    db:        Session = Depends(get_db),
    admin              = Depends(get_current_admin),
):
    """
    Reject a held claim after manual review.
    Writes an immutable FraudAuditLog row.
    """
    record = db.query(PayoutRecord).filter(PayoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payout record not found")
    if record.status not in ("held_for_review", "escalated"):
        raise HTTPException(status_code=400, detail=f"Cannot reject record with status '{record.status}'")

    previous_status = record.status

    record.status                 = "rejected"
    record.rejection_reason       = "MANUAL_REVIEW_REJECTED_BY_ADMIN"
    record.manual_review_required = False
    record.updated_at             = datetime.utcnow()

    audit = FraudAuditLog(
        payout_record_id = record.id,
        user_id          = record.user_id,
        admin_username   = admin.username,
        action           = "rejected",
        previous_status  = previous_status,
        new_status       = "rejected",
        notes            = body.notes,
    )
    db.add(audit)
    db.commit()
    db.refresh(record)

    return {
        "message":   f"Record {record_id} rejected",
        "status":    record.status,
        "record_id": record_id,
    }


# ── PATCH /admin/fraud/{record_id}/escalate  ← NEW ────────────────────────────
@router.patch("/fraud/{record_id}/escalate")
def escalate_fraud_case(
    record_id: int,
    body:      FraudActionRequest = FraudActionRequest(),
    db:        Session = Depends(get_db),
    admin              = Depends(get_current_admin),
):
    """
    Escalate a case for senior review — keeps it visible in the queue
    but marks it as needing a higher-level decision.
    Notes are mandatory for escalation.
    """
    if not body.notes or not body.notes.strip():
        raise HTTPException(
            status_code=422,
            detail="Notes are required when escalating a case"
        )

    record = db.query(PayoutRecord).filter(PayoutRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Payout record not found")
    if record.status not in ("held_for_review",):
        raise HTTPException(
            status_code=400,
            detail=f"Can only escalate held_for_review records (current: '{record.status}')"
        )

    previous_status = record.status

    # Escalated stays in the queue — senior admin sees it highlighted
    record.status     = "escalated"
    record.updated_at = datetime.utcnow()

    audit = FraudAuditLog(
        payout_record_id = record.id,
        user_id          = record.user_id,
        admin_username   = admin.username,
        action           = "escalated",
        previous_status  = previous_status,
        new_status       = "escalated",
        notes            = body.notes,
    )
    db.add(audit)
    db.commit()
    db.refresh(record)

    return {
        "message":   f"Record {record_id} escalated for senior review",
        "status":    record.status,
        "record_id": record_id,
    }


# ──────────────────────────────────────────────────────────────────────────────
# SERIALISER
# ──────────────────────────────────────────────────────────────────────────────

def _serialize_case(r: PayoutRecord) -> dict:
    return {
        "id":                     r.id,
        "payout_reference":       r.payout_reference,
        "user_id":                r.user_id,
        "disruption_type":        r.disruption_type,
        "fraud_risk_level":       r.fraud_risk_level,
        "fraud_score":            r.fraud_score or 0,
        "fraud_flags":            r.fraud_flags or [],
        "status":                 r.status,
        "final_payout_inr":       r.final_payout_inr or 0,
        "tentative_payout_inr":   (
            (r.calculation_breakdown or {}).get("after_cap_inr")
            or r.base_payout_inr or 0
        ),
        "manual_review_required": r.manual_review_required or False,
        "created_at":             r.created_at.isoformat() if r.created_at else None,
        "severity_level":         r.severity_level,
    }