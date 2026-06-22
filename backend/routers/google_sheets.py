"""
Google Sheets Connector — DataPilot
Two ways to pull in a Google Sheet:

1. PUBLIC SHEET (no auth needed) — sheet must be shared as
   "Anyone with the link can view". We just fetch the public
   CSV export URL. This covers most casual use cases.

2. PRIVATE SHEET via Service Account — for sheets the user
   hasn't made public. Requires a Google Cloud service account
   JSON key (set GOOGLE_SERVICE_ACCOUNT_JSON path in .env) and
   the user must share their sheet with that service account's
   email address. This is the standard way to access private
   Sheets server-side without per-user OAuth.
"""
import sys
import os
import re
import json
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
import requests

sys.path.append("..")

router = APIRouter()


class SheetPayload(BaseModel):
    sheet_url: str
    sheet_name: Optional[str] = None   # specific tab name, if not the first one


def _extract_sheet_id(url: str) -> str:
    match = re.search(r"/spreadsheets/d/([a-zA-Z0-9-_]+)", url)
    if not match:
        raise HTTPException(400, "Could not find a Google Sheet ID in that URL. Expected format: https://docs.google.com/spreadsheets/d/SHEET_ID/edit")
    return match.group(1)


def _df_to_dict(df):
    clean_df = df.replace([float("inf"), float("-inf")], None)
    clean_df = clean_df.where(pd.notnull(clean_df), None)
    return {
        "columns": df.columns.astype(str).tolist(),
        "data":    clean_df.values.tolist(),
        "shape":   list(df.shape),
        "dtypes":  {c: str(t) for c, t in df.dtypes.items()},
    }


@router.post("/public")
def load_public_sheet(payload: SheetPayload):
    """
    Load a Google Sheet that's been shared as 'Anyone with the link
    can view'. No credentials needed.
    """
    try:
        sheet_id = _extract_sheet_id(payload.sheet_url)

        gid = "0"
        gid_match = re.search(r"[#&]gid=(\d+)", payload.sheet_url)
        if gid_match:
            gid = gid_match.group(1)

        export_url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/export?format=csv&gid={gid}"
        resp = requests.get(export_url, timeout=15)

        if resp.status_code != 200 or "<html" in resp.text[:200].lower():
            raise HTTPException(400,
                "Could not access this sheet. Make sure it's shared as "
                "'Anyone with the link can view' (Share button → General access)."
            )

        from io import StringIO
        df = pd.read_csv(StringIO(resp.text))
        df.columns = df.columns.astype(str).str.strip()

        return {
            "success":  True,
            "filename": f"GoogleSheet_{sheet_id[:8]}",
            "raw":      _df_to_dict(df),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Could not load sheet: {str(e)[:300]}")


@router.post("/private")
def load_private_sheet(payload: SheetPayload):
    """
    Load a private Google Sheet via a service account. Requires
    GOOGLE_SERVICE_ACCOUNT_JSON env var pointing to a service account
    key file, and the sheet must be shared with that service
    account's email (found inside the JSON key as 'client_email').
    """
    creds_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not creds_path or not os.path.exists(creds_path):
        raise HTTPException(400,
            "Private Sheets require a Google service account configured on the server "
            "(GOOGLE_SERVICE_ACCOUNT_JSON in .env). Ask your admin to set this up, "
            "or share the sheet publicly and use the public-link option instead."
        )

    try:
        import gspread
        from google.oauth2.service_account import Credentials

        scopes = ["https://www.googleapis.com/auth/spreadsheets.readonly"]
        creds  = Credentials.from_service_account_file(creds_path, scopes=scopes)
        client = gspread.authorize(creds)

        sheet_id = _extract_sheet_id(payload.sheet_url)
        spreadsheet = client.open_by_key(sheet_id)
        worksheet = spreadsheet.worksheet(payload.sheet_name) if payload.sheet_name else spreadsheet.sheet1

        records = worksheet.get_all_records()
        if not records:
            raise HTTPException(400, "Sheet appears to be empty.")

        df = pd.DataFrame(records)

        return {
            "success":  True,
            "filename": f"{spreadsheet.title} — {worksheet.title}",
            "raw":      _df_to_dict(df),
        }
    except HTTPException:
        raise
    except Exception as e:
        with open(creds_path) as f:
            sa_email = json.load(f).get("client_email", "your-service-account")
        raise HTTPException(400,
            f"Could not load sheet: {str(e)[:200]}. "
            f"Make sure the sheet is shared with: {sa_email}"
        )


@router.get("/service-account-email")
def get_service_account_email():
    """Helper endpoint so the frontend can show the user which email to share their sheet with."""
    creds_path = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not creds_path or not os.path.exists(creds_path):
        return {"configured": False, "email": None}
    try:
        with open(creds_path) as f:
            email = json.load(f).get("client_email")
        return {"configured": True, "email": email}
    except Exception:
        return {"configured": False, "email": None}
