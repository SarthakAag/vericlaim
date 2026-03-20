from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordRequestForm

from app.database import SessionLocal
from app.models.admin_model import Admin
from app.schemas.admin_schema import AdminRegister
from app.utils.security import hash_password, verify_password
from app.utils.jwt_handler import create_access_token

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ADMIN REGISTER
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


# ADMIN LOGIN
@router.post("/login")
def admin_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    db_admin = db.query(Admin).filter(Admin.username == form_data.username).first()

    if not db_admin or not verify_password(form_data.password, db_admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token(
        data={"sub": db_admin.username, "role": "admin"}  # ← fix
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }