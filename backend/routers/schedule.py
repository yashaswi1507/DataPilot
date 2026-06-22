"""
Scheduled Reports — DataPilot
Lets a user schedule a report (PDF/PPT/HTML) to auto-generate
on a custom date/time, daily, weekly, or monthly cadence.

NOTE: requires the backend process to stay running continuously
(e.g. on the Oracle VM via systemd) — the scheduler only fires
while this process is alive. Email delivery is NOT implemented yet;
generated reports are stored in the `reports` table and show up on
the Reports page automatically.
"""
import sys
from datetime import datetime, date, time as dtime, timedelta
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import json

sys.path.append("..")
from database import get_db_conn
from routers.auth import get_current_user
from engines.export_engine import export_html, export_pdf, export_ppt

router = APIRouter()


# ── Request/response models ────────────────────────────────────
class ScheduleCreatePayload(BaseModel):
    report_name:     str
    columns:          List[str]
    data:             List[List[Any]]
    report_format:    str = "pdf"          # pdf / ppt / html
    frequency:        str                  # once / daily / weekly / monthly
    scheduled_time:   str                  # "HH:MM" 24-hour
    scheduled_date:   Optional[str] = None # "YYYY-MM-DD" — required for once/monthly anchor/weekly anchor
    kpis:             Dict[str, Any] = {}
    insights:         List[str] = []


def _compute_next_run(frequency: str, scheduled_time: str, scheduled_date: Optional[str]) -> datetime:
    """Work out the next datetime this schedule should fire."""
    hh, mm = [int(x) for x in scheduled_time.split(":")[:2]]
    now = datetime.now()

    if frequency == "once":
        if not scheduled_date:
            raise HTTPException(400, "scheduled_date is required for a one-time report")
        d = datetime.strptime(scheduled_date, "%Y-%m-%d").date()
        run_at = datetime.combine(d, dtime(hh, mm))
        if run_at <= now:
            raise HTTPException(400, "scheduled_date/time must be in the future")
        return run_at

    if frequency == "daily":
        run_at = datetime.combine(now.date(), dtime(hh, mm))
        if run_at <= now:
            run_at += timedelta(days=1)
        return run_at

    if frequency == "weekly":
        if not scheduled_date:
            raise HTTPException(400, "scheduled_date is required for weekly (used to derive day-of-week)")
        anchor_dow = datetime.strptime(scheduled_date, "%Y-%m-%d").weekday()  # 0=Mon
        run_at = datetime.combine(now.date(), dtime(hh, mm))
        days_ahead = (anchor_dow - now.weekday()) % 7
        run_at += timedelta(days=days_ahead)
        if run_at <= now:
            run_at += timedelta(days=7)
        return run_at

    if frequency == "monthly":
        if not scheduled_date:
            raise HTTPException(400, "scheduled_date is required for monthly (used to derive day-of-month)")
        target_day = datetime.strptime(scheduled_date, "%Y-%m-%d").day
        year, month = now.year, now.month
        try:
            run_at = datetime(year, month, target_day, hh, mm)
        except ValueError:
            # day doesn't exist this month (e.g. 31st in Feb) — push to next month
            month += 1
            if month > 12:
                month = 1; year += 1
            run_at = datetime(year, month, 1, hh, mm)
        if run_at <= now:
            month += 1
            if month > 12:
                month = 1; year += 1
            try:
                run_at = datetime(year, month, target_day, hh, mm)
            except ValueError:
                run_at = datetime(year, month, 28, hh, mm)
        return run_at

    raise HTTPException(400, f"Unknown frequency: {frequency}")


@router.post("/create")
def create_schedule(payload: ScheduleCreatePayload, user=Depends(get_current_user)):
    """Create a new scheduled report."""
    try:
        next_run = _compute_next_run(payload.frequency, payload.scheduled_time, payload.scheduled_date)

        snapshot = json.dumps({
            "columns": payload.columns,
            "data":    payload.data,
            "kpis":    payload.kpis,
            "insights": payload.insights,
        })

        anchor_date = None
        if payload.scheduled_date:
            anchor_date = payload.scheduled_date

        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO scheduled_reports
                (user_id, report_name, dataset_snapshot, report_format, frequency,
                 scheduled_time, scheduled_date, next_run_at, is_active)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,TRUE)
            RETURNING id
        """, (
            user["user_id"], payload.report_name, snapshot, payload.report_format,
            payload.frequency, payload.scheduled_time, anchor_date, next_run,
        ))
        new_id = cur.fetchone()["id"]
        conn.commit()
        conn.close()

        return {
            "success": True,
            "id": new_id,
            "next_run_at": next_run.isoformat(),
            "message": f"Report scheduled — will run {payload.frequency} starting {next_run.strftime('%d %b %Y, %I:%M %p')}",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Could not create schedule: {e}")


@router.get("/list")
def list_schedules(user=Depends(get_current_user)):
    """List all schedules for the logged-in user."""
    try:
        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT id, report_name, report_format, frequency, scheduled_time,
                   scheduled_date, is_active, last_run_at, next_run_at, created_at
            FROM scheduled_reports
            WHERE user_id = %s
            ORDER BY next_run_at ASC
        """, (user["user_id"],))
        rows = cur.fetchall()
        conn.close()

        for r in rows:
            for k in ("scheduled_date", "last_run_at", "next_run_at", "created_at"):
                if r.get(k) is not None:
                    r[k] = r[k].isoformat()
            if r.get("scheduled_time") is not None:
                r["scheduled_time"] = str(r["scheduled_time"])

        return {"success": True, "schedules": rows}
    except Exception as e:
        raise HTTPException(500, f"Could not list schedules: {e}")


@router.post("/{schedule_id}/toggle")
def toggle_schedule(schedule_id: int, user=Depends(get_current_user)):
    """Pause/resume a schedule."""
    try:
        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute("""
            UPDATE scheduled_reports SET is_active = NOT is_active
            WHERE id = %s AND user_id = %s
            RETURNING is_active
        """, (schedule_id, user["user_id"]))
        row = cur.fetchone()
        if not row:
            conn.close()
            raise HTTPException(404, "Schedule not found")
        conn.commit()
        conn.close()
        return {"success": True, "is_active": row["is_active"]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.delete("/{schedule_id}")
def delete_schedule(schedule_id: int, user=Depends(get_current_user)):
    """Delete a scheduled report."""
    try:
        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute("DELETE FROM scheduled_reports WHERE id=%s AND user_id=%s", (schedule_id, user["user_id"]))
        conn.commit()
        conn.close()
        return {"success": True}
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Background runner (called by APScheduler in main.py) ───────
def run_due_schedules():
    """
    Polled every minute by APScheduler (see main.py).
    Finds schedules whose next_run_at has passed, generates the report,
    saves it to the `reports` table, and computes the next run time.
    """
    try:
        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT * FROM scheduled_reports
            WHERE is_active = TRUE AND next_run_at <= NOW()
        """)
        due = cur.fetchall()

        for sched in due:
            try:
                snapshot = sched["dataset_snapshot"]
                if isinstance(snapshot, str):
                    snapshot = json.loads(snapshot)

                fmt = sched["report_format"]
                name = sched["report_name"]
                kpis = snapshot.get("kpis", {})
                insights = snapshot.get("insights", [])

                if fmt == "pdf":
                    file_bytes = export_pdf(name, kpis, [], insights)
                elif fmt in ("ppt", "pptx"):
                    file_bytes = export_ppt(name, kpis, [], insights)
                else:
                    file_bytes = export_html(name, kpis, [], insights)

                # Save into reports table so it shows on the Reports page
                cur.execute("""
                    INSERT INTO reports (user_id, name, charts, insights, kpis)
                    VALUES (%s, %s, %s, %s, %s)
                """, (
                    sched["user_id"],
                    f"{name} ({datetime.now().strftime('%d %b %Y')})",
                    json.dumps([]), json.dumps(insights), json.dumps(kpis),
                ))

                # Compute next run, or deactivate if it was a one-off
                if sched["frequency"] == "once":
                    cur.execute("""
                        UPDATE scheduled_reports
                        SET is_active = FALSE, last_run_at = NOW()
                        WHERE id = %s
                    """, (sched["id"],))
                else:
                    anchor = sched["scheduled_date"].isoformat() if sched.get("scheduled_date") else None
                    next_run = _compute_next_run(sched["frequency"], str(sched["scheduled_time"]), anchor)
                    cur.execute("""
                        UPDATE scheduled_reports
                        SET last_run_at = NOW(), next_run_at = %s
                        WHERE id = %s
                    """, (next_run, sched["id"]))

                conn.commit()
            except Exception as inner_e:
                print(f"[scheduler] Failed to run schedule {sched['id']}: {inner_e}")
                conn.rollback()

        conn.close()
    except Exception as e:
        print(f"[scheduler] run_due_schedules error: {e}")
