"""
User Data Router — Reports, History, Activity
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Any, Dict, Optional
import json

from database import get_db_conn
from routers.auth import get_current_user

router = APIRouter()


# ── Activity ──────────────────────────────────────────────────
@router.post("/activity")
def log_activity(
    payload: dict,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO activity (user_id, action) VALUES (%s, %s)",
            (current_user["user_id"], payload.get("action", ""))
        )
        conn.commit()
        return JSONResponse({"success": True})
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.get("/activity")
def get_activity(current_user: dict = Depends(get_current_user)):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT action, created_at FROM activity WHERE user_id = %s ORDER BY created_at DESC LIMIT 20",
            (current_user["user_id"],)
        )
        rows = cur.fetchall()
        return JSONResponse({"success": True, "activity": [dict(r) for r in rows]})
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()


# ── Datasets history ──────────────────────────────────────────
class DatasetLog(BaseModel):
    filename:     str
    rows:         int
    cols:         int
    dataset_type: str = ""


@router.post("/datasets/log")
def log_dataset(
    payload: DatasetLog,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO datasets (user_id, filename, rows, cols, dataset_type) VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (current_user["user_id"], payload.filename, payload.rows, payload.cols, payload.dataset_type)
        )
        dataset_id = cur.fetchone()["id"]
        conn.commit()
        return JSONResponse({"success": True, "dataset_id": dataset_id})
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.get("/datasets")
def get_datasets(current_user: dict = Depends(get_current_user)):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, filename, rows, cols, dataset_type, uploaded_at FROM datasets WHERE user_id = %s ORDER BY uploaded_at DESC LIMIT 20",
            (current_user["user_id"],)
        )
        rows = cur.fetchall()
        return JSONResponse({"success": True, "datasets": [dict(r) for r in rows]})
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()


# ── Reports ───────────────────────────────────────────────────
class SaveReportPayload(BaseModel):
    name:     str
    charts:   List[Dict]
    insights: List[str]
    kpis:     Dict


@router.post("/reports/save")
def save_report(
    payload: SaveReportPayload,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db_conn()
    try:
        cur = conn.cursor()

        # Check duplicate name
        cur.execute(
            "SELECT id FROM reports WHERE user_id = %s AND name = %s",
            (current_user["user_id"], payload.name)
        )
        if cur.fetchone():
            raise HTTPException(400, f"Report '{payload.name}' already exists.")

        cur.execute(
            "INSERT INTO reports (user_id, name, charts, insights, kpis) VALUES (%s,%s,%s,%s,%s) RETURNING id",
            (
                current_user["user_id"],
                payload.name,
                json.dumps(payload.charts),
                json.dumps(payload.insights),
                json.dumps(payload.kpis),
            )
        )
        report_id = cur.fetchone()["id"]
        conn.commit()

        # Log activity
        cur.execute(
            "INSERT INTO activity (user_id, action) VALUES (%s, %s)",
            (current_user["user_id"], f"Report '{payload.name}' saved")
        )
        conn.commit()

        return JSONResponse({"success": True, "report_id": report_id})
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.get("/reports")
def get_reports(current_user: dict = Depends(get_current_user)):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, name, charts, insights, kpis, created_at FROM reports WHERE user_id = %s ORDER BY created_at DESC",
            (current_user["user_id"],)
        )
        rows = cur.fetchall()
        reports = []
        for r in rows:
            reports.append({
                "id":         r["id"],
                "name":       r["name"],
                "charts":     r["charts"],
                "insights":   r["insights"],
                "kpis":       r["kpis"],
                "created_at": str(r["created_at"]),
            })
        return JSONResponse({"success": True, "reports": reports})
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.delete("/reports/{report_id}")
def delete_report(
    report_id: int,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM reports WHERE id = %s AND user_id = %s",
            (report_id, current_user["user_id"])
        )
        conn.commit()
        return JSONResponse({"success": True})
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


# ── Query history ─────────────────────────────────────────────
class QueryLog(BaseModel):
    query:  str
    result: Dict


@router.post("/queries/log")
def log_query(
    payload: QueryLog,
    current_user: dict = Depends(get_current_user)
):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO query_history (user_id, query, result) VALUES (%s,%s,%s)",
            (current_user["user_id"], payload.query, json.dumps(payload.result))
        )
        conn.commit()
        return JSONResponse({"success": True})
    except Exception as e:
        conn.rollback()
        raise HTTPException(500, str(e))
    finally:
        conn.close()


@router.get("/queries")
def get_queries(current_user: dict = Depends(get_current_user)):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        cur.execute(
            "SELECT query, result, created_at FROM query_history WHERE user_id = %s ORDER BY created_at DESC LIMIT 20",
            (current_user["user_id"],)
        )
        rows = cur.fetchall()
        return JSONResponse({"success": True, "queries": [dict(r) for r in rows]})
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()


# ── Stats ─────────────────────────────────────────────────────
@router.get("/stats")
def get_stats(current_user: dict = Depends(get_current_user)):
    conn = get_db_conn()
    try:
        cur = conn.cursor()
        uid = current_user["user_id"]

        cur.execute("SELECT COUNT(*) as c FROM datasets      WHERE user_id = %s", (uid,))
        datasets_count = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) as c FROM reports       WHERE user_id = %s", (uid,))
        reports_count = cur.fetchone()["c"]

        cur.execute("SELECT COUNT(*) as c FROM query_history WHERE user_id = %s", (uid,))
        queries_count = cur.fetchone()["c"]

        return JSONResponse({
            "success":  True,
            "stats": {
                "datasets_uploaded":  datasets_count,
                "reports_saved":      reports_count,
                "queries_run":        queries_count,
            }
        })
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        conn.close()
