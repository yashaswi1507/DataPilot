"""
Organizations / Company Plans — DataPilot
Lets a company sign up for a Team/Business/Enterprise plan, invite
team members by email, and manage seats. The signing-up user becomes
the org admin automatically.

Tier reference (seats included, price is per-seat/month):
  team        — 2 to 10 seats   — ₹399/seat
  business    — 11 to 50 seats  — ₹299/seat
  enterprise  — 50+ seats       — custom pricing, contact sales

This module only handles the org/seats/invite mechanics — actual
payment processing isn't wired up (no Razorpay/Stripe integration
yet), so seat purchases are recorded but not billed automatically.
"""
import sys
import secrets
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr

sys.path.append("..")
from database import get_db_conn
from routers.auth import get_current_user

router = APIRouter()

# ── Plan tiers ───────────────────────────────────────────────
ORG_PLAN_TIERS = {
    "team":       {"label": "Team",       "min_seats": 2,  "max_seats": 10,  "price_per_seat": 399, "custom_pricing": False},
    "business":   {"label": "Business",   "min_seats": 11, "max_seats": 50,  "price_per_seat": 299, "custom_pricing": False},
    "enterprise": {"label": "Enterprise", "min_seats": 51, "max_seats": None,"price_per_seat": None,"custom_pricing": True},
}


def _validate_seats(plan: str, seats: int):
    tier = ORG_PLAN_TIERS.get(plan)
    if not tier:
        raise HTTPException(400, f"Unknown plan tier: {plan}")
    if seats < tier["min_seats"]:
        raise HTTPException(400, f"{tier['label']} plan requires at least {tier['min_seats']} seats.")
    if tier["max_seats"] and seats > tier["max_seats"]:
        raise HTTPException(400, f"{tier['label']} plan supports up to {tier['max_seats']} seats. For more, use Enterprise.")


def _require_org_admin(user_id: int) -> dict:
    """Fetch the user's org membership and verify they're an admin."""
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT organization_id, org_role FROM users WHERE id = %s", (user_id,))
        row = cur.fetchone()
        if not row or not row["organization_id"]:
            raise HTTPException(400, "You're not part of an organization.")
        if row["org_role"] != "admin":
            raise HTTPException(403, "Only the organization admin can do this.")
        return row
    finally:
        conn.close()


# ── Request models ──────────────────────────────────────────
class CreateOrgPayload(BaseModel):
    name: str
    plan: str            # 'team' / 'business' / 'enterprise'
    seats: int


class InvitePayload(BaseModel):
    email: EmailStr


class AcceptInvitePayload(BaseModel):
    invite_token: str
    name: str
    password: str


@router.get("/plans")
def list_plans():
    """Returns the tier catalog for the pricing page / upgrade flow."""
    return {"success": True, "tiers": ORG_PLAN_TIERS}


@router.post("/create")
def create_organization(payload: CreateOrgPayload, user=Depends(get_current_user)):
    """
    Converts the current user's account into an organization admin and
    creates the org. A user can only belong to one organization at a time.
    """
    if payload.plan != "enterprise":
        _validate_seats(payload.plan, payload.seats)
    elif payload.seats < ORG_PLAN_TIERS["enterprise"]["min_seats"]:
        raise HTTPException(400, f"Enterprise plan requires at least {ORG_PLAN_TIERS['enterprise']['min_seats']} seats.")

    conn = get_db_conn()
    try:
        cur = conn.cursor()

        cur.execute("SELECT organization_id FROM users WHERE id = %s", (user["user_id"],))
        existing = cur.fetchone()
        if existing and existing["organization_id"]:
            raise HTTPException(400, "You're already part of an organization.")

        cur.execute(
            """INSERT INTO organizations (name, plan, seats_purchased, owner_user_id)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (payload.name.strip(), payload.plan, payload.seats, user["user_id"])
        )
        org_id = cur.fetchone()["id"]

        cur.execute(
            "UPDATE users SET organization_id = %s, org_role = 'admin', plan = %s WHERE id = %s",
            (org_id, payload.plan, user["user_id"])
        )
        conn.commit()

        tier = ORG_PLAN_TIERS[payload.plan]
        estimated_cost = None if tier["custom_pricing"] else tier["price_per_seat"] * payload.seats

        return {
            "success": True,
            "organization_id": org_id,
            "plan": payload.plan,
            "seats_purchased": payload.seats,
            "estimated_monthly_cost": estimated_cost,
            "message": (
                f"Organization '{payload.name}' created on the {tier['label']} plan "
                f"({payload.seats} seats). " +
                (f"Estimated cost: ₹{estimated_cost}/month." if estimated_cost else "Contact sales for Enterprise pricing.")
            ),
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, f"Could not create organization: {e}")
    finally:
        conn.close()


@router.get("/me")
def get_my_organization(user=Depends(get_current_user)):
    """Returns the org info + member list + seat usage for the current user's org."""
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT organization_id FROM users WHERE id = %s", (user["user_id"],))
        row = cur.fetchone()
        if not row or not row["organization_id"]:
            return {"success": True, "in_organization": False}

        org_id = row["organization_id"]
        cur.execute("SELECT * FROM organizations WHERE id = %s", (org_id,))
        org = cur.fetchone()

        cur.execute(
            "SELECT id, name, email, org_role, created_at FROM users WHERE organization_id = %s ORDER BY created_at ASC",
            (org_id,)
        )
        members = cur.fetchall()

        cur.execute(
            "SELECT id, invited_email, status, created_at FROM team_invitations WHERE organization_id = %s AND status = 'pending' ORDER BY created_at DESC",
            (org_id,)
        )
        pending_invites = cur.fetchall()

        for m in members:
            m["created_at"] = m["created_at"].isoformat()
        for inv in pending_invites:
            inv["created_at"] = inv["created_at"].isoformat()
        org["created_at"] = org["created_at"].isoformat()
        if org.get("usage_reset_at"):
            org["usage_reset_at"] = org["usage_reset_at"].isoformat()

        tier = ORG_PLAN_TIERS.get(org["plan"], {})

        return {
            "success": True,
            "in_organization": True,
            "organization": org,
            "tier_info": tier,
            "members": members,
            "pending_invites": pending_invites,
            "seats_used": len(members),
            "seats_available": max(0, org["seats_purchased"] - len(members)),
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.post("/invite")
def invite_member(payload: InvitePayload, user=Depends(get_current_user)):
    """Admin-only: invite a new team member by email."""
    admin_row = _require_org_admin(user["user_id"])
    org_id = admin_row["organization_id"]

    conn = get_db_conn()
    try:
        cur = conn.cursor()

        cur.execute("SELECT seats_purchased FROM organizations WHERE id = %s", (org_id,))
        org = cur.fetchone()

        cur.execute("SELECT COUNT(*) as cnt FROM users WHERE organization_id = %s", (org_id,))
        current_members = cur.fetchone()["cnt"]

        cur.execute("SELECT COUNT(*) as cnt FROM team_invitations WHERE organization_id = %s AND status = 'pending'", (org_id,))
        pending_count = cur.fetchone()["cnt"]

        if current_members + pending_count >= org["seats_purchased"]:
            raise HTTPException(400, "No seats available. Purchase more seats or revoke a pending invite.")

        cur.execute("SELECT id FROM users WHERE email = %s", (payload.email.lower(),))
        if cur.fetchone():
            raise HTTPException(400, "This email is already a DataPilot user. Ask them to join your org from their account settings instead.")

        token = secrets.token_urlsafe(24)
        cur.execute(
            """INSERT INTO team_invitations (organization_id, invited_email, invited_by_user_id, invite_token)
               VALUES (%s, %s, %s, %s) RETURNING id""",
            (org_id, payload.email.lower(), user["user_id"], token)
        )
        conn.commit()

        # NOTE: actual email delivery isn't wired up yet (same limitation
        # as scheduled reports) — for now the invite link must be shared
        # manually. Frontend shows it directly to the admin to copy/send.
        return {
            "success": True,
            "invite_link": f"/accept-invite?token={token}",
            "message": f"Invite created for {payload.email}. Share this link with them (email delivery not yet automated).",
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.post("/accept-invite")
def accept_invite(payload: AcceptInvitePayload):
    """
    Public endpoint — the invited person creates their account using
    the invite token, which automatically attaches them to the org
    as a 'member' (not admin).
    """
    if len(payload.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM team_invitations WHERE invite_token = %s AND status = 'pending'",
            (payload.invite_token,)
        )
        invite = cur.fetchone()
        if not invite:
            raise HTTPException(404, "Invalid or already-used invite link.")

        cur.execute("SELECT id FROM users WHERE email = %s", (invite["invited_email"],))
        if cur.fetchone():
            raise HTTPException(400, "An account with this email already exists.")

        cur.execute("SELECT plan FROM organizations WHERE id = %s", (invite["organization_id"],))
        org_plan = cur.fetchone()["plan"]

        from routers.auth import hash_password, create_token
        hashed = hash_password(payload.password)

        cur.execute(
            """INSERT INTO users (email, name, password, plan, organization_id, org_role)
               VALUES (%s, %s, %s, %s, %s, 'member') RETURNING id""",
            (invite["invited_email"], payload.name.strip(), hashed, org_plan, invite["organization_id"])
        )
        new_user_id = cur.fetchone()["id"]

        cur.execute(
            "UPDATE team_invitations SET status = 'accepted', accepted_at = NOW() WHERE id = %s",
            (invite["id"],)
        )
        conn.commit()

        token = create_token(new_user_id, invite["invited_email"])
        return {
            "success": True,
            "token": token,
            "user": {
                "id": new_user_id, "email": invite["invited_email"],
                "name": payload.name.strip(), "plan": org_plan, "org_role": "member",
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.post("/revoke-invite/{invite_id}")
def revoke_invite(invite_id: int, user=Depends(get_current_user)):
    admin_row = _require_org_admin(user["user_id"])
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE team_invitations SET status = 'revoked' WHERE id = %s AND organization_id = %s",
            (invite_id, admin_row["organization_id"])
        )
        conn.commit()
        return {"success": True}
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.post("/remove-member/{member_user_id}")
def remove_member(member_user_id: int, user=Depends(get_current_user)):
    """Admin-only: remove a member from the org (downgrades them to 'free')."""
    admin_row = _require_org_admin(user["user_id"])
    if member_user_id == user["user_id"]:
        raise HTTPException(400, "You can't remove yourself. Transfer ownership first or delete the organization.")

    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET organization_id = NULL, org_role = NULL, plan = 'free' WHERE id = %s AND organization_id = %s",
            (member_user_id, admin_row["organization_id"])
        )
        if cur.rowcount == 0:
            raise HTTPException(404, "Member not found in your organization.")
        conn.commit()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.post("/update-seats")
def update_seats(seats: int, user=Depends(get_current_user)):
    """Admin-only: change the number of purchased seats."""
    admin_row = _require_org_admin(user["user_id"])
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT plan FROM organizations WHERE id = %s", (admin_row["organization_id"],))
        plan = cur.fetchone()["plan"]
        if plan != "enterprise":
            _validate_seats(plan, seats)

        cur.execute("SELECT COUNT(*) as cnt FROM users WHERE organization_id = %s", (admin_row["organization_id"],))
        current_members = cur.fetchone()["cnt"]
        if seats < current_members:
            raise HTTPException(400, f"Can't reduce below current member count ({current_members}). Remove members first.")

        cur.execute("UPDATE organizations SET seats_purchased = %s WHERE id = %s", (seats, admin_row["organization_id"]))
        conn.commit()
        return {"success": True, "seats_purchased": seats}
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()
