from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base

# ROUTES
from app.routes import auth
from app.routes import admin_routes
from app.routes import policy_routes
from app.routes import enrollment_routes
from app.routes import premium_routes
from app.routes import earnings_routes   # NEW

# MODELS
from app.models.user_model import DeliveryPartner
from app.models.admin_model import Admin
from app.models.policy_model import InsurancePolicy
from app.models.enrollment_model import PolicyEnrollment
from app.models.premium_model import PremiumPayment
from app.models.earnings_model import DeliveryEarnings   # NEW

app = FastAPI(
    title="Gig Worker Insurance API",
    version="1.0"
)

# CORS (IMPORTANT FOR NEXTJS)
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
app.include_router(auth.router, prefix="/auth", tags=["User Auth"])
app.include_router(admin_routes.router, prefix="/admin", tags=["Admin Auth"])
app.include_router(policy_routes.router, prefix="/policy", tags=["Policy"])
app.include_router(enrollment_routes.router, prefix="/enrollment", tags=["Enrollment"])
app.include_router(premium_routes.router, prefix="/premium", tags=["Premium"])
app.include_router(earnings_routes.router, prefix="/earnings", tags=["Earnings"])  # NEW