"""
PAMA MVS Auth module
====================
JWT (HS256) + bcrypt password hashing + role gating.

User store: backend/data/users.json (read on demand, lightweight for MVS).
Roles: "super_admin", "roc_dispatcher".
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Iterable

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

# Muat .env (root project lalu fallback ke backend/). Optional dep.
try:
    from dotenv import load_dotenv
    _ROOT_ENV = Path(__file__).resolve().parent.parent / ".env"
    _BACKEND_ENV = Path(__file__).resolve().parent / ".env"
    if _ROOT_ENV.exists():
        load_dotenv(_ROOT_ENV)
    elif _BACKEND_ENV.exists():
        load_dotenv(_BACKEND_ENV)
except ImportError:
    pass  # dotenv belum terinstall → env var bisa di-set manual

JWT_SECRET = os.environ.get("JWT_SECRET", "pama-mvs-dev-secret")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_SECONDS = int(os.environ.get("JWT_EXPIRY_SECONDS", 8 * 3600))

USERS_FILE = Path(__file__).parent / "data" / "users.json"

# bcrypt context — pakai sha256 prefix tidak perlu, bcrypt cukup
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# tokenUrl hanya untuk OpenAPI docs; flow login custom (POST /auth/login)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# -------------------- password --------------------

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        return False


# -------------------- user store --------------------

def load_users() -> list[dict]:
    if not USERS_FILE.exists():
        return []
    try:
        data = json.loads(USERS_FILE.read_text(encoding="utf-8"))
        return data.get("users", [])
    except (json.JSONDecodeError, OSError):
        return []


def find_user_by_username(username: str) -> dict | None:
    for u in load_users():
        if u.get("username") == username:
            return u
    return None


def find_user_by_id(user_id: str) -> dict | None:
    for u in load_users():
        if u.get("id") == user_id:
            return u
    return None


def public_user(user: dict) -> dict:
    """User dict tanpa password_hash — aman dikirim ke client."""
    return {
        "id": user.get("id"),
        "username": user.get("username"),
        "role": user.get("role"),
        "site": user.get("site"),
        "name": user.get("name"),
    }


# -------------------- JWT --------------------

def create_access_token(user: dict) -> str:
    now = int(time.time())
    payload = {
        "sub": user["id"],
        "username": user["username"],
        "role": user["role"],
        "site": user.get("site"),
        "iat": now,
        "exp": now + JWT_EXPIRY_SECONDS,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Return JWT claims dict, atau raise JWTError jika invalid/expired."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# -------------------- FastAPI dependencies --------------------

def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token tidak ditemukan",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        claims = decode_token(token)
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token invalid: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = find_user_by_id(claims.get("sub"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User tidak ditemukan",
        )
    return public_user(user)


def require_role(*roles: str):
    """Dependency factory: return user kalau role-nya di whitelist."""
    allowed = set(roles)

    def _guard(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.get('role')}' tidak diizinkan akses endpoint ini",
            )
        return user

    return _guard


def validate_ws_token(token: str | None) -> dict | None:
    """Untuk WebSocket: return user dict atau None kalau invalid."""
    if not token:
        return None
    try:
        claims = decode_token(token)
    except JWTError:
        return None
    user = find_user_by_id(claims.get("sub"))
    return public_user(user) if user else None
