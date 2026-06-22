"""
JWT Authentication — DataPilot
Register, Login, Token verify — no third party needed.
"""
import os
import re
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

# ── Student plan config ──────────────────────────────────────
# Verified-domain students get more daily "tokens" (analysis/ML/chat
# actions) than self-declared students, since we trust the domain
# check more. Both reset every 24 hours.
STUDENT_EMAIL_DOMAINS_SUFFIXES = (".edu", ".ac.in", ".edu.in")
DAILY_TOKENS_VERIFIED_STUDENT  = 200
DAILY_TOKENS_SELF_DECLARED     = 100


def is_student_email(email: str) -> bool:
    """Check if an email's domain matches known academic suffixes."""
    email = email.lower().strip()
    return any(email.endswith(suffix) or f"{suffix}" in email.split("@")[-1] for suffix in STUDENT_EMAIL_DOMAINS_SUFFIXES)


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
    is_student_selfdeclared: bool = False   # checkbox fallback when domain check doesn't match


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

    email_lower = payload.email.lower()
    verified_student = is_student_email(email_lower)
    is_student = verified_student or payload.is_student_selfdeclared

    # If they're a student (verified or self-declared), force the plan to "student"
    final_plan = "student" if is_student else payload.plan

    conn = get_db_conn()
    try:
        cur = conn.cursor()

        # Check if email exists
        cur.execute("SELECT id FROM users WHERE email = %s", (email_lower,))
        if cur.fetchone():
            raise HTTPException(400, "Email already registered. Please login.")

        # Insert user
        hashed = hash_password(payload.password)
        cur.execute(
            """INSERT INTO users (email, name, password, plan, is_student, student_verified)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (email_lower, payload.name.strip(), hashed, final_plan, is_student, verified_student)
        )
        user_id = cur.fetchone()["id"]
        conn.commit()

        # Log activity
        cur.execute(
            "INSERT INTO activity (user_id, action) VALUES (%s, %s)",
            (user_id, "Account created")
        )
        conn.commit()

        token = create_token(user_id, email_lower)
        return JSONResponse({
            "success": True,
            "token":   token,
            "user": {
                "id":    user_id,
                "email": email_lower,
                "name":  payload.name.strip(),
                "plan":  final_plan,
                "is_student": is_student,
                "student_verified": verified_student,
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
            """SELECT id, email, name, password, plan, is_student, student_verified
               FROM users WHERE email = %s""",
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
                "is_student": user["is_student"],
                "student_verified": user["student_verified"],
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
            """SELECT id, email, name, plan, created_at, is_student, student_verified
               FROM users WHERE id = %s""",
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


@router.get("/tokens")
def get_token_status(current_user: dict = Depends(get_current_user)):
    """
    Returns the student's daily token usage/limit. Resets every 24h
    from the last reset timestamp (rolling window, not midnight-based).
    Non-students get unlimited (this endpoint is only meaningful for
    student-plan accounts, but works for anyone).
    """
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT is_student, student_verified, daily_tokens_used, daily_tokens_reset_at
               FROM users WHERE id = %s""",
            (current_user["user_id"],)
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(404, "User not found.")

        if not user["is_student"]:
            return {"success": True, "is_student": False, "unlimited": True}

        limit = DAILY_TOKENS_VERIFIED_STUDENT if user["student_verified"] else DAILY_TOKENS_SELF_DECLARED
        reset_at = user["daily_tokens_reset_at"]
        now = datetime.utcnow()

        # Rolling 24h reset
        used = user["daily_tokens_used"]
        if reset_at and (now - reset_at.replace(tzinfo=None)) >= timedelta(hours=24):
            cur.execute(
                "UPDATE users SET daily_tokens_used = 0, daily_tokens_reset_at = NOW() WHERE id = %s",
                (current_user["user_id"],)
            )
            conn.commit()
            used = 0
            reset_at = now

        next_reset = reset_at + timedelta(hours=24) if reset_at else now + timedelta(hours=24)

        return {
            "success": True,
            "is_student": True,
            "student_verified": user["student_verified"],
            "tokens_used": used,
            "tokens_limit": limit,
            "tokens_remaining": max(0, limit - used),
            "resets_at": next_reset.isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()


def consume_token(user_id: int, amount: int = 1) -> bool:
    """
    Call this from any endpoint that should count against a student's
    daily limit (e.g. running ML training, forecasts, AI queries).
    Returns False if the user is out of tokens (caller should then
    raise a 429). Non-students always return True (unlimited).
    """
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT is_student, student_verified, daily_tokens_used, daily_tokens_reset_at FROM users WHERE id = %s",
            (user_id,)
        )
        user = cur.fetchone()
        if not user or not user["is_student"]:
            return True  # non-students: unlimited

        limit = DAILY_TOKENS_VERIFIED_STUDENT if user["student_verified"] else DAILY_TOKENS_SELF_DECLARED
        now = datetime.utcnow()
        reset_at = user["daily_tokens_reset_at"]
        used = user["daily_tokens_used"]

        if reset_at and (now - reset_at.replace(tzinfo=None)) >= timedelta(hours=24):
            used = 0
            cur.execute("UPDATE users SET daily_tokens_used = 0, daily_tokens_reset_at = NOW() WHERE id = %s", (user_id,))

        if used + amount > limit:
            conn.commit()
            return False

        cur.execute("UPDATE users SET daily_tokens_used = daily_tokens_used + %s WHERE id = %s", (amount, user_id))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        return True  # fail open — don't block the user if token tracking itself breaks
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
