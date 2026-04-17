"""
Renewal Routes  —  /renewals/*
Guidewire DEVTrails 2026 — VeriClaim AI Platform

Admin-only endpoints:
  GET  /renewals/stats        — KPI cards for dashboard Renewals tab
  GET  /renewals/history      — paginated renewal log feed
  GET  /renewals/upcoming     — enrollments renewing next Monday
  POST /renewals/run-now      — fire immediate renewal cycle (demo button)
  POST /renewals/expiry-check — fire immediate expiry check
  GET  /renewals/status       — scheduler health
"""

from __future__ import annotations

from datetime import datetime, date, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database import get_db
from app.models.renewal_log_model import RenewalLog
from app.models.enrollment_model  import PolicyEnrollment
from app.models.premium_model     import PremiumPayment
from app.models.user_model        import DeliveryPartner
from app.services.renewal_service import renewal_service
from app.dependencies.admin_auth import get_current_admin

router = APIRouter(prefix="/renewals", tags=["Policy Renewals"])


# ──────────────────────────────────────────────────────────────────────────────
# GET /renewals/stats
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_renewal_stats(
    weeks: int     = Query(default=4, description="Look-back in weeks"),
    db:    Session = Depends(get_db),
    _admin         = Depends(get_current_admin),
):
    """
    KPI numbers for the admin dashboard Renewals tab.
    """
    cutoff = date.today() - timedelta(weeks=weeks)

    base = db.query(RenewalLog).filter(RenewalLog.week_start >= cutoff)

    total_processed = base.count()
    renewed_count   = base.filter(RenewalLog.outcome == "renewed").count()
    expired_count   = base.filter(RenewalLog.outcome == "expired").count()
    suspended_count = base.filter(RenewalLog.outcome == "suspended").count()
    error_count     = base.filter(RenewalLog.outcome == "error").count()

    total_premium = (
        db.query(func.coalesce(func.sum(RenewalLog.premium_inr), 0))
        .filter(
            RenewalLog.week_start >= cutoff,
            RenewalLog.outcome    == "renewed",
        )
        .scalar()
    )

    # This week's numbers
    week_start = date.today() - timedelta(days=date.today().weekday())
    this_week_renewed = (
        db.query(func.count(RenewalLog.id))
        .filter(
            RenewalLog.week_start == week_start,
            RenewalLog.outcome    == "renewed",
        )
        .scalar() or 0
    )
    this_week_premium = (
        db.query(func.coalesce(func.sum(RenewalLog.premium_inr), 0))
        .filter(
            RenewalLog.week_start == week_start,
            RenewalLog.outcome    == "renewed",
        )
        .scalar()
    )

    # Active enrollments count
    active_count = (
        db.query(func.count(PolicyEnrollment.id))
        .filter(PolicyEnrollment.status == "active")
        .scalar() or 0
    )
    auto_renew_on = (
        db.query(func.count(PolicyEnrollment.id))
        .filter(
            PolicyEnrollment.status     == "active",
            PolicyEnrollment.auto_renew == True,
        )
        .scalar() or 0
    )

    # Renewal rate
    renewal_rate = round(renewed_count / total_processed * 100, 1) if total_processed else 0

    # Weekly trend (last 8 weeks) for sparkline
    weekly_trend = (
        db.query(
            RenewalLog.week_start,
            func.count(RenewalLog.id).label("count"),
            func.coalesce(func.sum(RenewalLog.premium_inr), 0).label("premium"),
        )
        .filter(
            RenewalLog.week_start >= date.today() - timedelta(weeks=8),
            RenewalLog.outcome    == "renewed",
        )
        .group_by(RenewalLog.week_start)
        .order_by(RenewalLog.week_start)
        .all()
    )

    # Tier breakdown
    tier_breakdown = (
        db.query(
            RenewalLog.policy_tier,
            func.count(RenewalLog.id).label("count"),
            func.coalesce(func.sum(RenewalLog.premium_inr), 0).label("premium"),
        )
        .filter(
            RenewalLog.week_start >= cutoff,
            RenewalLog.outcome    == "renewed",
            RenewalLog.policy_tier.isnot(None),
        )
        .group_by(RenewalLog.policy_tier)
        .order_by(desc("count"))
        .all()
    )

    return {
        "window_weeks":         weeks,
        "active_enrollments":   active_count,
        "auto_renew_enabled":   auto_renew_on,
        "auto_renew_opt_out":   active_count - auto_renew_on,
        "total_processed":      total_processed,
        "renewed_count":        renewed_count,
        "expired_count":        expired_count,
        "suspended_count":      suspended_count,
        "error_count":          error_count,
        "renewal_rate_pct":     renewal_rate,
        "total_premium_inr":    round(float(total_premium), 2),
        "this_week": {
            "renewed":     this_week_renewed,
            "premium_inr": round(float(this_week_premium), 2),
            "week_start":  week_start.isoformat(),
        },
        "weekly_trend": [
            {
                "week_start": r.week_start.isoformat(),
                "count":      r.count,
                "premium":    round(float(r.premium), 2),
            }
            for r in weekly_trend
        ],
        "tier_breakdown": [
            {
                "tier":    r.policy_tier,
                "count":   r.count,
                "premium": round(float(r.premium), 2),
            }
            for r in tier_breakdown
        ],
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /renewals/history
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/history")
def get_renewal_history(
    limit:   int           = Query(default=50, le=200),
    offset:  int           = Query(default=0),
    outcome: Optional[str] = Query(default=None),
    weeks:   int           = Query(default=4),
    db:      Session       = Depends(get_db),
    _admin                 = Depends(get_current_admin),
):
    """Paginated renewal log — feeds the admin history table."""
    cutoff = date.today() - timedelta(weeks=weeks)
    query  = db.query(RenewalLog).filter(RenewalLog.week_start >= cutoff)

    if outcome:
        query = query.filter(RenewalLog.outcome == outcome.lower())

    total = query.count()
    rows  = (
        query
        .order_by(desc(RenewalLog.processed_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total":  total,
        "offset": offset,
        "limit":  limit,
        "rows": [
            {
                "id":           r.id,
                "user_id":      r.user_id,
                "enrollment_id":r.enrollment_id,
                "run_id":       r.run_id,
                "outcome":      r.outcome,
                "premium_inr":  r.premium_inr,
                "week_start":   r.week_start.isoformat(),
                "policy_tier":  r.policy_tier,
                "zone":         r.zone,
                "error_message":r.error_message,
                "processed_at": r.processed_at.isoformat() if r.processed_at else None,
            }
            for r in rows
        ],
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /renewals/upcoming
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/upcoming")
def get_upcoming_renewals(
    db:    Session = Depends(get_db),
    _admin         = Depends(get_current_admin),
):
    """
    Enrollments due for renewal next Monday.
    Shows drivers who will be auto-renewed vs those who opted out.
    """
    today      = date.today()
    next_monday = today + timedelta(days=(7 - today.weekday()) % 7 or 7)

    active = (
        db.query(PolicyEnrollment, DeliveryPartner)
        .join(DeliveryPartner, PolicyEnrollment.user_id == DeliveryPartner.id)
        .filter(PolicyEnrollment.status == "active")
        .all()
    )

    will_renew    = []
    will_not_renew = []

    for enrollment, partner in active:
        entry = {
            "user_id":       partner.id,
            "enrollment_id": enrollment.id,
            "policy_tier":   enrollment.policy_tier,
            "zone":          getattr(partner, "zone", None),
            "auto_renew":    enrollment.auto_renew,
            "end_date":      enrollment.end_date.isoformat() if enrollment.end_date else None,
            "will_expire":   bool(enrollment.end_date and enrollment.end_date < next_monday),
        }
        if enrollment.auto_renew and not entry["will_expire"]:
            will_renew.append(entry)
        else:
            will_not_renew.append(entry)

    return {
        "next_renewal_date":  next_monday.isoformat(),
        "will_renew_count":   len(will_renew),
        "will_not_renew_count": len(will_not_renew),
        "will_renew":         will_renew[:50],      # cap for UI
        "will_not_renew":     will_not_renew[:50],
    }


# ──────────────────────────────────────────────────────────────────────────────
# POST /renewals/run-now
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/run-now")
def run_renewal_now(
    _admin = Depends(get_current_admin),
):
    """
    Fire an immediate renewal cycle — the admin dashboard 'Process Now' button.
    Blocks until complete, returns the cycle summary.
    """
    try:
        summary = renewal_service.run_now()
        return {"success": True, "summary": summary}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ──────────────────────────────────────────────────────────────────────────────
# POST /renewals/expiry-check
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/expiry-check")
def run_expiry_check(
    _admin = Depends(get_current_admin),
):
    """Fire the mid-week expiry check immediately."""
    try:
        result = renewal_service.run_expiry_check_now()
        return {"success": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ──────────────────────────────────────────────────────────────────────────────
# GET /renewals/status
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/status")
def get_renewal_scheduler_status(
    _admin = Depends(get_current_admin),
):
    """Scheduler health — next run times for both jobs."""
    sched = renewal_service._scheduler
    jobs  = {}

    if sched:
        for job_id in ("weekly_renewal", "midweek_expiry_check"):
            job = sched.get_job(job_id)
            if job and job.next_run_time:
                jobs[job_id] = job.next_run_time.isoformat()
            else:
                jobs[job_id] = None

    return {
        "scheduler_running": renewal_service.is_running,
        "next_runs":         jobs,
    }