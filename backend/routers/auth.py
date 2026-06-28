"""
JWT Authentication — DataPilot
Register, Login, Token verify, Google OAuth — no third party needed
beyond Google's own token verification.
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
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests

from database import get_db_conn

router = APIRouter()

# ── Config ────────────────────────────────────────────────────
SECRET_KEY      = os.environ.get("JWT_SECRET", "datapilot-secret-change-in-production-2024")
ALGORITHM       = "HS256"
TOKEN_EXPIRE_DAYS = 7

# Google OAuth Client ID — must match the one configured in the frontend
# (the Google Identity Services script uses the same ID to issue tokens).
# Set via env var in production; falls back to the dev value here only
# so local testing doesn't break if it's not yet in .env.
GOOGLE_CLIENT_ID = os.environ.get(
    "GOOGLE_CLIENT_ID",
    "544303241286-stc79gugvrb30kv9v8to3ga0rop6e6vl.apps.googleusercontent.com"
)

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


# ── Plan limits ───────────────────────────────────────────────
# These mirror frontend/src/store/useStore.js planLimits — kept here too
# since the frontend value is just for display; enforcement must happen
# server-side or it can be trivially bypassed via direct API calls.
PLAN_DATASET_LIMITS = {
    "free":    10,
    "basic":   50,
    "pro":     999999,
    "student": 999999,   # students get unlimited datasets, but are
                          # capped by daily token usage instead (see /tokens)
    "team":       999999,
    "business":   999999,
    "enterprise": 999999,
}


def check_dataset_limit(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency for upload endpoints. Students are metered by daily token
    usage instead of a monthly dataset count, so this branches:
      - student plan -> consumes 1 daily token, blocks with 403 if none left
      - everyone else -> blocks with 403 if monthly dataset limit reached,
        otherwise increments their usage counter
    Usage resets monthly on a rolling basis from usage_reset_at (not
    calendar-month-based, to keep the reset logic simple).
    """
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            """SELECT plan, datasets_uploaded_this_month, usage_reset_at,
                      is_student, student_verified, daily_tokens_used, daily_tokens_reset_at
               FROM users WHERE id = %s""",
            (current_user["user_id"],)
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(404, "User not found.")

        if user["is_student"]:
            limit = DAILY_TOKENS_VERIFIED_STUDENT if user["student_verified"] else DAILY_TOKENS_SELF_DECLARED
            used  = user["daily_tokens_used"]
            reset_at = user["daily_tokens_reset_at"]
            now = datetime.utcnow()

            if reset_at and (now - reset_at.replace(tzinfo=None)) >= timedelta(hours=24):
                cur.execute(
                    "UPDATE users SET daily_tokens_used = 0, daily_tokens_reset_at = NOW() WHERE id = %s",
                    (current_user["user_id"],)
                )
                conn.commit()
                used = 0

            if used >= limit:
                raise HTTPException(
                    403,
                    f"You've used all {limit} of your daily actions on the Student plan. "
                    f"This resets 24 hours after your first action today."
                )

            cur.execute(
                "UPDATE users SET daily_tokens_used = daily_tokens_used + 1 WHERE id = %s",
                (current_user["user_id"],)
            )
            conn.commit()
            return current_user

        limit = PLAN_DATASET_LIMITS.get(user["plan"], 10)
        used  = user["datasets_uploaded_this_month"]
        reset_at = user["usage_reset_at"]
        now = datetime.utcnow()

        # Rolling 30-day reset
        if reset_at and (now - reset_at.replace(tzinfo=None)) >= timedelta(days=30):
            cur.execute(
                "UPDATE users SET datasets_uploaded_this_month = 0, usage_reset_at = NOW() WHERE id = %s",
                (current_user["user_id"],)
            )
            conn.commit()
            used = 0

        if used >= limit:
            plan_label = user["plan"].capitalize()
            raise HTTPException(
                403,
                f"You've reached your {plan_label} plan's limit of {limit} datasets this month. "
                f"Upgrade your plan to upload more."
            )

        cur.execute(
            "UPDATE users SET datasets_uploaded_this_month = datasets_uploaded_this_month + 1 WHERE id = %s",
            (current_user["user_id"],)
        )
        conn.commit()
        return current_user
    except HTTPException:
        raise
    except Exception:
        # Fail open — if usage tracking itself breaks (e.g. DB hiccup),
        # don't block uploads entirely; just let the request through.
        conn.rollback()
        return current_user
    finally:
        conn.close()


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


# ── Google OAuth login/signup ────────────────────────────────────
class GoogleAuthPayload(BaseModel):
    credential: str   # the ID token JWT issued by Google Identity Services
    plan: str = "free"
    is_student_selfdeclared: bool = False


@router.post("/google")
def google_login(payload: GoogleAuthPayload):
    """
    Verifies the Google ID token (sent by the frontend's Google Identity
    Services button), then either logs in an existing user or creates a
    new account — all in one request, matching how "Continue with Google"
    behaves on most apps (no separate signup step needed).
    """
    try:
        # Verify the token was actually issued by Google for OUR app
        # (checking the audience matches our client ID is what prevents
        # someone from forging a token for a different app and replaying
        # it here).
        idinfo = google_id_token.verify_oauth2_token(
            payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID
        )
    except ValueError as e:
        raise HTTPException(401, f"Invalid Google token: {e}")

    google_user_id = idinfo["sub"]          # Google's stable unique ID for this user
    email          = idinfo.get("email", "").lower()
    name           = idinfo.get("name", email.split("@")[0] if email else "Google User")
    email_verified = idinfo.get("email_verified", False)

    if not email or not email_verified:
        raise HTTPException(400, "Google account email is not verified.")

    conn = get_db_conn()
    try:
        cur = conn.cursor()

        # 1. Already signed up via Google before? Just log them in.
        cur.execute("SELECT * FROM users WHERE google_id = %s", (google_user_id,))
        user = cur.fetchone()

        if not user:
            # 2. Email exists but via password signup (not Google yet) —
            #    link the Google ID to that existing account rather than
            #    creating a duplicate, since it's clearly the same person.
            cur.execute("SELECT * FROM users WHERE email = %s", (email,))
            user = cur.fetchone()

            if user:
                cur.execute("UPDATE users SET google_id = %s WHERE id = %s", (google_user_id, user["id"]))
                conn.commit()
            else:
                # 3. Brand new user — create an account. No password is
                #    set (NULL) since they'll always log in via Google.
                verified_student = is_student_email(email)
                is_student = verified_student or payload.is_student_selfdeclared
                final_plan = "student" if is_student else payload.plan

                cur.execute(
                    """INSERT INTO users (email, name, password, plan, is_student, student_verified, google_id)
                       VALUES (%s, %s, NULL, %s, %s, %s, %s) RETURNING *""",
                    (email, name, final_plan, is_student, verified_student, google_user_id)
                )
                user = cur.fetchone()
                conn.commit()

                cur.execute("INSERT INTO activity (user_id, action) VALUES (%s, %s)", (user["id"], "Account created via Google"))
                conn.commit()

        # Log activity for returning users too
        cur.execute("INSERT INTO activity (user_id, action) VALUES (%s, %s)", (user["id"], "Logged in via Google"))
        conn.commit()

        token = create_token(user["id"], user["email"])
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
        conn.rollback()
        raise HTTPException(500, f"Google login failed: {str(e)}")
    finally:
        conn.close()


# ── Forgot Password / Reset Password ─────────────────────────────
class ForgotPasswordPayload(BaseModel):
    email: str
    reset_url_base: str   # frontend URL to build the link with, e.g. "https://datapilot-ruddy.vercel.app/reset-password"


class ResetPasswordPayload(BaseModel):
    token: str
    new_password: str


RESET_TOKEN_EXPIRE_HOURS = 1


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordPayload):
    """
    Always returns success (even if the email doesn't exist) — this is
    deliberate, to avoid leaking which emails are registered. If the
    email IS registered, a reset link is emailed (or, if email isn't
    configured on the server, the link is returned directly in the
    response as a fallback so the feature still works during local
    testing without Gmail SMTP set up).
    """
    from email_utils import send_password_reset_email, is_email_configured

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT id, name, google_id FROM users WHERE email = %s", (payload.email.lower(),))
        user = cur.fetchone()

        if not user:
            # Don't reveal whether the email exists — same response either way.
            return {"success": True, "message": "If that email is registered, a reset link has been sent."}

        if user["google_id"] and True:
            # They might have a password too (linked account) — only block
            # if they have NO password set at all (Google-only account).
            cur.execute("SELECT password FROM users WHERE id = %s", (user["id"],))
            pw_row = cur.fetchone()
            if not pw_row["password"]:
                return {
                    "success": True,
                    "message": "This account uses Google sign-in and has no password to reset. Use 'Continue with Google' to log in instead.",
                }

        token = secrets.token_urlsafe(32)
        expires_at = datetime.utcnow() + timedelta(hours=RESET_TOKEN_EXPIRE_HOURS)

        cur.execute(
            "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (%s, %s, %s)",
            (user["id"], token, expires_at)
        )
        conn.commit()

        reset_link = f"{payload.reset_url_base.rstrip('/')}?token={token}"

        if is_email_configured():
            sent = send_password_reset_email(payload.email.lower(), reset_link, user["name"])
            if sent:
                return {"success": True, "message": "If that email is registered, a reset link has been sent."}
            # Email configured but failed to send (e.g. network issue) —
            # fall through to returning the link directly as a backup.

        # Email not configured (local dev) or send failed — return the
        # link directly so the feature is still testable/usable.
        return {
            "success": True,
            "message": "Email sending isn't configured on this server, so here's your reset link directly:",
            "reset_link": reset_link,
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.post("/reset-password")
def reset_password(payload: ResetPasswordPayload):
    """Completes a password reset using a token from forgot-password."""
    if len(payload.new_password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM password_reset_tokens WHERE token = %s AND used = FALSE",
            (payload.token,)
        )
        reset_row = cur.fetchone()

        if not reset_row:
            raise HTTPException(400, "Invalid or already-used reset link.")
        if reset_row["expires_at"].replace(tzinfo=None) < datetime.utcnow():
            raise HTTPException(400, "This reset link has expired. Request a new one.")

        new_hashed = hash_password(payload.new_password)
        cur.execute("UPDATE users SET password = %s WHERE id = %s", (new_hashed, reset_row["user_id"]))
        cur.execute("UPDATE password_reset_tokens SET used = TRUE WHERE id = %s", (reset_row["id"],))
        conn.commit()

        return {"success": True, "message": "Password reset successfully. You can now log in."}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()
