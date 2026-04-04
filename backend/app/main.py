from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
import logging

# ROUTES
from app.routes import auth
from app.routes import admin_routes
from app.routes import policy_routes
from app.routes import enrollment_routes
from app.routes import premium_routes
from app.routes import earnings_routes
from app.routes import risk_map_routes

# MODELS
from app.models.user_model import DeliveryPartner
from app.models.admin_model import Admin
from app.models.policy_model import InsurancePolicy
from app.models.enrollment_model import PolicyEnrollment
from app.models.premium_model import PremiumPayment
from app.models.earnings_model import DeliveryEarnings
from app.models.payout_model import PayoutRecord, PredictionHistory

logger = logging.getLogger(__name__)

app = FastAPI(
    title="VeriClaim — Food Delivery Partner Insurance",        # ← was: "Gig Worker Insurance API"
    description="Parametric income protection for Zomato & Swiggy food delivery partners in Chennai.",
    version="2.0"                                               # ← was: "1.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# CREATE DATABASE TABLES
Base.metadata.create_all(bind=engine)

# ROUTERS
app.include_router(auth.router,              prefix="/auth",       tags=["User Auth"])
app.include_router(admin_routes.router,      prefix="/admin",      tags=["Admin Auth"])
app.include_router(policy_routes.router,     prefix="/policy",     tags=["Policy"])
app.include_router(enrollment_routes.router, prefix="/enrollment", tags=["Enrollment"])
app.include_router(premium_routes.router,    prefix="/premium",    tags=["Premium"])
app.include_router(earnings_routes.router,   prefix="/earnings",   tags=["Earnings"])
app.include_router(risk_map_routes.router,                         tags=["Delivery Risk Map"])


# ── Eager ML model loading — fails loud at startup, not silently mid-demo ─────
@app.on_event("startup")
async def load_ml_models():
    try:
        from app.services.ml_risk_model import get_model
        get_model()
        logger.info("✅ ML models loaded — food delivery risk model ready")
    except RuntimeError as e:
        logger.critical(f"🚨 STARTUP FAILED — run train_model.py first: {e}")
        raise