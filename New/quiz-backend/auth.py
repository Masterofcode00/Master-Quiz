"""
auth.py
All authentication utilities:
  • Password hashing with bcrypt via passlib
  • JWT creation and verification with python-jose
  • FastAPI dependency  get_current_user()  that protects routes
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models import User

# ── Config ──────────────────────────────────────────────────────
SECRET_KEY  = os.getenv("SECRET_KEY", "CHANGE-ME-IN-PRODUCTION-supersecretkey1234!")
ALGORITHM   = os.getenv("ALGORITHM", "HS256")
EXPIRE_MIN  = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours

# ── Password hashing ────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

# ── JWT ─────────────────────────────────────────────────────────
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    payload = data.copy()
    expire  = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=EXPIRE_MIN))
    payload.update({"exp": expire})
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """
    Decode and validate a JWT.
    Raises HTTPException 401 on any failure.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise credentials_exc
        return payload
    except JWTError:
        raise credentials_exc


# ── FastAPI dependencies ─────────────────────────────────────────

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db:    Session = Depends(get_db),
) -> User:
    """Dependency: resolves the authenticated User from the Bearer token."""
    payload  = decode_token(token)
    username = payload.get("sub")
    user     = db.query(User).filter(User.username == username).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive.",
        )
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Dependency: same as get_current_user but also requires role='admin'."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required for this action.",
        )
    return current_user


def get_current_user_optional(
    token: Optional[str] = Depends(OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)),
    db:    Session = Depends(get_db),
) -> Optional[User]:
    """
    Like get_current_user but returns None instead of raising 401.
    Useful for routes that are readable by anyone but write-protected.
    """
    if not token:
        return None
    try:
        payload  = decode_token(token)
        username = payload.get("sub")
        return db.query(User).filter(User.username == username, User.is_active == True).first()
    except HTTPException:
        return None