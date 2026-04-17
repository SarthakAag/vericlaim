"""
VeriClaim AI — FastAPI Entry Point  v3.0
Guidewire DEVTrails 2026

Phase 3 schedulers:
  • trigger_monitor  — parametric auto-trigger   (every 5 min)
  • renewal_service  — policy auto-renewal        (Mon 00:05 IST)
                       mid-week expiry check      (Thu 00:05 IST)
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
import logging

# ── Routes ────────────────────────────────────────────────────────────────────
from app.routes import auth
from app.routes import admin_routes
from app.routes import policy_routes
from app.routes import enrollment_routes
from app.routes import premium_routes
from app.routes import earnings_routes
from app.routes import risk_map_routes
from app.routes import trigger_routes       # Phase 3
from app.routes import renewal_routes       # Phase 3

# ── Models (must be imported before Base.metadata.create_all) ─────────────────
from app.models.user_model        import DeliveryPartner
from app.models.admin_model       import Admin
from app.models.policy_model      import InsurancePolicy
from app.models.enrollment_model  import PolicyEnrollment
from app.models.premium_model     import PremiumPayment
from app.models.earnings_model    import DeliveryEarnings
from app.models.payout_model      import PayoutRecord, PredictionHistory
from app.models.trigger_model     import TriggerEvent       # Phase 3
from app.models.fraud_audit_model import FraudAuditLog      # Phase 3
from app.models.renewal_log_model import RenewalLog         # Phase 3

# ── Schedulers ────────────────────────────────────────────────────────────────
from app.services.trigger_monitor import trigger_monitor    # Phase 3
from app.services.renewal_service  import renewal_service   # Phase 3

logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="VeriClaim — Food Delivery Partner Insurance",
    description=(
        "Parametric income protection for Zomato & Swiggy food delivery "
        "partners in Chennai. Automated trigger monitoring and policy "
        "auto-renewal included."
    ),
    version="3.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Create DB tables ──────────────────────────────────────────────────────────
Base.metadata.create_all(bind=engine)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router,              prefix="/auth",       tags=["User Auth"])
app.include_router(admin_routes.router,      prefix="/admin",      tags=["Admin"])
app.include_router(policy_routes.router,     prefix="/policy",     tags=["Policy"])
app.include_router(enrollment_routes.router, prefix="/enrollment", tags=["Enrollment"])
app.include_router(premium_routes.router,    prefix="/premium",    tags=["Premium"])
app.include_router(earnings_routes.router,   prefix="/earnings",   tags=["Earnings"])
app.include_router(risk_map_routes.router,                         tags=["Risk Map"])
app.include_router(trigger_routes.router,                          tags=["Trigger Monitor"])
app.include_router(renewal_routes.router,                          tags=["Policy Renewals"])


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # 1. Load ML models — fail loud so the bug surfaces before the demo
    try:
        from app.services.ml_risk_model import get_model
        get_model()
        logger.info("✅ ML models loaded — food delivery risk model ready")
    except RuntimeError as e:
        logger.critical(f"🚨 STARTUP FAILED — run train_model.py first: {e}")
        raise

    # 2. Start background schedulers — failures are logged but do NOT crash the API
    for name, svc in [
        ("Trigger monitor", trigger_monitor),
        ("Renewal service",  renewal_service),
    ]:
        try:
            svc.start()
            logger.info(f"✅ {name} started")
        except Exception as e:
            logger.error(f"⚠️  {name} failed to start: {e}", exc_info=True)


# ── Shutdown ──────────────────────────────────────────────────────────────────
@app.on_event("shutdown")
async def shutdown():
    trigger_monitor.stop()
    renewal_service.stop()
    logger.info("👋 VeriClaim API shut down")


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
def health_check():
    from app.services.trigger_monitor import POLL_INTERVAL_MINUTES

    r_sched = renewal_service._scheduler
    r_jobs = {}
    if r_sched:
        for jid in ("weekly_renewal", "midweek_expiry_check"):
            job = r_sched.get_job(jid)
            r_jobs[jid] = job.next_run_time.isoformat() if job and job.next_run_time else None

    return {
        "status":  "ok",
        "version": "3.0",
        "trigger_monitor": {
            "running":      trigger_monitor.is_running,
            "interval_min": POLL_INTERVAL_MINUTES,
        },
        "renewal_service": {
            "running":   renewal_service.is_running,
            "next_runs": r_jobs,
        },
    }