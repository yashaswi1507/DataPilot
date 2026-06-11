"""
JWT Authentication — DataPilot
Register, Login, Token verify — no third party needed.
"""
import os
import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Header
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from jose import JWTError, jwt

from database import get_db_conn

router = APIRouter()

# ── Config ────────────────────────────────────────────────────
SECRET_KEY      = os.environ.get("JWT_SECRET", "datapilot-secret-change-in-production-2024")
ALGORITHM       = "HS256"
TOKEN_EXPIRE_DAYS = 7


# ── Password hashing ─────────────────────────────────────────
def hash_password(password: str) -> str:
    """SHA-256 + salt hashing."""
    salt = secrets.token_hex(16)
    hashed = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{hashed}"


def verify_password(plain: str, hashed: str) -> bool:
    """Verify password against stored hash."""
    try:
        salt, stored_hash = hashed.split(":")
        check = hashlib.sha256(f"{salt}{plain}".encode()).hexdigest()
        return check == stored_hash
    except Exception:
        return False


# ── JWT tokens ────────────────────────────────────────────────
def create_token(user_id: int, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email":   email,
        "exp":     datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(401, "Invalid or expired token. Please login again.")


# ── Get current user from token ───────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authorization header missing. Please login.")
    token   = authorization.split(" ")[1]
    payload = decode_token(token)
    return payload


# ── Request models ────────────────────────────────────────────
class RegisterPayload(BaseModel):
    name:     str
    email:    str
    password: str
    plan:     str = "free"


class LoginPayload(BaseModel):
    email:    str
    password: str


# ── Routes ────────────────────────────────────────────────────
@router.post("/register")
def register(payload: RegisterPayload):
    """Register new user."""
    if len(payload.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")

    if len(payload.name.strip()) < 2:
        raise HTTPException(400, "Name must be at least 2 characters.")

    conn = get_db_conn()
    try:
        cur = conn.cursor()

        # Check if email exists
        cur.execute("SELECT id FROM users WHERE email = %s", (payload.email.lower(),))
        if cur.fetchone():
            raise HTTPException(400, "Email already registered. Please login.")

        # Insert user
        hashed = hash_password(payload.password)
        cur.execute(
            "INSERT INTO users (email, name, password, plan) VALUES (%s, %s, %s, %s) RETURNING id",
            (payload.email.lower(), payload.name.strip(), hashed, payload.plan)
        )
        user_id = cur.fetchone()["id"]
        conn.commit()

        # Log activity
        cur.execute(
            "INSERT INTO activity (user_id, action) VALUES (%s, %s)",
            (user_id, "Account created")
        )
        conn.commit()

        token = create_token(user_id, payload.email.lower())
        return JSONResponse({
            "success": True,
            "token":   token,
            "user": {
                "id":    user_id,
                "email": payload.email.lower(),
                "name":  payload.name.strip(),
                "plan":  payload.plan,
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"Registration failed: {str(e)}")
    finally:
        conn.close()


@router.post("/login")
def login(payload: LoginPayload):
    """Login with email + password."""
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, name, password, plan FROM users WHERE email = %s",
            (payload.email.lower(),)
        )
        user = cur.fetchone()

        if not user or not verify_password(payload.password, user["password"]):
            raise HTTPException(401, "Invalid email or password.")

        token = create_token(user["id"], user["email"])

        # Log activity
        cur.execute(
            "INSERT INTO activity (user_id, action) VALUES (%s, %s)",
            (user["id"], "Logged in")
        )
        conn.commit()

        return JSONResponse({
            "success": True,
            "token":   token,
            "user": {
                "id":    user["id"],
                "email": user["email"],
                "name":  user["name"],
                "plan":  user["plan"],
            }
        })

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Login failed: {str(e)}")
    finally:
        conn.close()


@router.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    """Get current user profile."""
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, name, plan, created_at FROM users WHERE id = %s",
            (current_user["user_id"],)
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(404, "User not found.")
        return JSONResponse({"success": True, "user": dict(user)})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.post("/change-password")
def change_password(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    """Change user password."""
    old_password = payload.get("old_password", "")
    new_password = payload.get("new_password", "")

    if len(new_password) < 8:
        raise HTTPException(400, "New password must be at least 8 characters.")

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT password FROM users WHERE id = %s", (current_user["user_id"],))
        user = cur.fetchone()

        if not verify_password(old_password, user["password"]):
            raise HTTPException(401, "Old password is incorrect.")

        new_hashed = hash_password(new_password)
        cur.execute(
            "UPDATE users SET password = %s WHERE id = %s",
            (new_hashed, current_user["user_id"])
        )
        conn.commit()
        return JSONResponse({"success": True, "message": "Password changed successfully."})
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()
