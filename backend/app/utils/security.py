from passlib.context import CryptContext

# PASSWORD HASHING
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT CONFIG
SECRET_KEY = "9f7c2a1e4b8d6f3c5a7e9d1b2c4f8c5r"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)