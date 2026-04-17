"""
Trigger Monitor Routes  —  /triggers/*
Guidewire DEVTrails 2026 — VeriClaim AI Platform

Admin-only endpoints to:
  • GET  /triggers/feed          — paginated real-time event feed
  • GET  /triggers/stats         — summary stats for admin dashboard KPIs
  • POST /triggers/run-now       — fire an immediate scheduler cycle (demo button)
  • GET  /triggers/status        — is the scheduler currently running?
  • GET  /triggers/{event_id}    — drill-down on a single event
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.database import get_db
from app.models.trigger_model import TriggerEvent
from app.services.trigger_monitor import trigger_monitor
from app.dependencies.admin_auth import get_current_admin   # reuse your existing admin auth

router = APIRouter(prefix="/triggers", tags=["Trigger Monitor"])


# ──────────────────────────────────────────────────────────────────────────────
# GET /triggers/feed  — paginated event list for admin dashboard
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/feed")
def get_trigger_feed(
    limit:   int            = Query(default=50, le=200),
    offset:  int            = Query(default=0),
    status:  Optional[str]  = Query(default=None, description="Filter by status e.g. PAYOUT_APPROVED"),
    hours:   int            = Query(default=24,  description="Look-back window in hours"),
    db:      Session        = Depends(get_db),
    _admin                  = Depends(get_current_admin),
):
    """
    Returns the most recent trigger events for the admin dashboard feed.
    Each row is one driver × one scheduler cycle.
    """
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    query = (
        db.query(TriggerEvent)
        .filter(TriggerEvent.evaluated_at >= cutoff)
    )

    if status:
        query = query.filter(TriggerEvent.status == status.upper())

    total  = query.count()
    events = (
        query
        .order_by(desc(TriggerEvent.evaluated_at))
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total":  total,
        "offset": offset,
        "limit":  limit,
        "events": [_serialize_event(e) for e in events],
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /triggers/stats  — KPI cards for admin dashboard
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/stats")
def get_trigger_stats(
    hours: int     = Query(default=24),
    db:    Session = Depends(get_db),
    _admin         = Depends(get_current_admin),
):
    """
    Aggregate stats for the last N hours — powers the KPI cards.
    """
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    base = db.query(TriggerEvent).filter(TriggerEvent.evaluated_at >= cutoff)

    total_evaluated  = base.count()
    triggers_fired   = base.filter(TriggerEvent.auto_claim_eligible == True).count()
    payouts_approved = base.filter(TriggerEvent.payout_status == "APPROVED").count()
    payouts_held     = base.filter(TriggerEvent.payout_status == "HELD_FOR_REVIEW").count()
    fraud_flagged    = base.filter(TriggerEvent.status == "FRAUD_FLAGGED").count()
    errors           = base.filter(TriggerEvent.status == "ERROR").count()

    total_paid_out   = (
        db.query(func.coalesce(func.sum(TriggerEvent.payout_amount_inr), 0))
        .filter(
            TriggerEvent.evaluated_at >= cutoff,
            TriggerEvent.payout_status == "APPROVED",
        )
        .scalar()
    )

    # Breakdown by disruption type (for the bar chart)
    disruption_breakdown = (
        db.query(
            TriggerEvent.disruption_type,
            func.count(TriggerEvent.id).label("count"),
        )
        .filter(
            TriggerEvent.evaluated_at >= cutoff,
            TriggerEvent.disruption_type.isnot(None),
        )
        .group_by(TriggerEvent.disruption_type)
        .order_by(desc("count"))
        .all()
    )

    # Hourly trigger rate for the sparkline chart
    hourly_rate = (
        db.query(
            func.strftime("%Y-%m-%dT%H:00:00", TriggerEvent.evaluated_at).label("hour"),
            func.count(TriggerEvent.id).label("count"),
        )
        .filter(TriggerEvent.evaluated_at >= cutoff)
        .group_by("hour")
        .order_by("hour")
        .all()
    )

    return {
        "window_hours":        hours,
        "total_evaluated":     total_evaluated,
        "triggers_fired":      triggers_fired,
        "payouts_approved":    payouts_approved,
        "payouts_held":        payouts_held,
        "fraud_flagged":       fraud_flagged,
        "errors":              errors,
        "total_paid_out_inr":  round(float(total_paid_out), 2),
        "trigger_rate_pct":    round(triggers_fired / total_evaluated * 100, 1)
                               if total_evaluated else 0,
        "disruption_breakdown": [
            {"type": r.disruption_type, "count": r.count}
            for r in disruption_breakdown
        ],
        "hourly_rate": [
            {"hour": r.hour, "count": r.count}
            for r in hourly_rate
        ],
    }


# ──────────────────────────────────────────────────────────────────────────────
# POST /triggers/run-now  — immediate cycle (demo button)
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/run-now")
def run_trigger_cycle_now(
    _admin = Depends(get_current_admin),
):
    """
    Fire an immediate scheduler cycle.
    Use this as the 'Run Now' button in the admin dashboard during the demo.
    Returns the cycle summary synchronously (blocks until complete).
    """
    try:
        summary = trigger_monitor.run_now()
        return {"success": True, "summary": summary}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# ──────────────────────────────────────────────────────────────────────────────
# GET /triggers/status  — scheduler health check
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/status")
def get_scheduler_status(
    _admin = Depends(get_current_admin),
):
    """
    Is the automated scheduler running?
    Shows the next scheduled run time.
    """
    from app.services.trigger_monitor import POLL_INTERVAL_MINUTES

    scheduler = trigger_monitor._scheduler
    next_run   = None
    if scheduler:
        job = scheduler.get_job("trigger_monitor_cycle")
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()

    return {
        "scheduler_running":     trigger_monitor.is_running,
        "poll_interval_minutes": POLL_INTERVAL_MINUTES,
        "next_run_at":           next_run,
    }


# ──────────────────────────────────────────────────────────────────────────────
# GET /triggers/{event_id}  — single event drill-down
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/{event_id}")
def get_trigger_event(
    event_id: int,
    db:       Session = Depends(get_db),
    _admin            = Depends(get_current_admin),
):
    event = db.query(TriggerEvent).filter(TriggerEvent.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="TriggerEvent not found")
    return _serialize_event(event, full=True)


# ──────────────────────────────────────────────────────────────────────────────
# Serialiser
# ──────────────────────────────────────────────────────────────────────────────

def _serialize_event(e: TriggerEvent, full: bool = False) -> dict:
    base = {
        "id":                  e.id,
        "user_id":             e.user_id,
        "scheduler_run_id":    e.scheduler_run_id,
        "driver_location":     e.driver_location,
        "status":              e.status,
        "disruption_type":     e.disruption_type,
        "severity_level":      e.severity_level,
        "risk_score":          e.risk_score,
        "delay_minutes":       e.delay_minutes,
        "income_loss_inr":     e.income_loss_inr,
        "auto_claim_eligible": e.auto_claim_eligible,
        "fraud_risk":          e.fraud_risk,
        "fraud_flags":         e.fraud_flags,
        "payout_reference":    e.payout_reference,
        "payout_amount_inr":   e.payout_amount_inr,
        "payout_status":       e.payout_status,
        "processing_ms":       e.processing_ms,
        "evaluated_at":        e.evaluated_at.isoformat() if e.evaluated_at else None,
        "error_message":       e.error_message,
    }
    if full:
        base["detection_report"] = e.detection_report
    return base