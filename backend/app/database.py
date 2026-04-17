from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 🔑 Your PostgreSQL connection
DATABASE_URL = "postgresql+psycopg2://postgres:Sart2012%40@localhost:5432/insurance_db"

# ⚙️ Engine (with stability improvements)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,   # avoids stale connections
)

# 🗄️ Session config (important for FastAPI)
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# 📦 Base model
Base = declarative_base()

# ✅ REQUIRED: FastAPI dependency (fixes your error)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()