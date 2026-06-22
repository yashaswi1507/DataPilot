"""
Annotations / Comments — DataPilot
Lets a user leave notes on a chart, dataset, or report — e.g.
"This spike is from the Diwali sale". Comments are tied to the
logged-in user but readable by anyone who has access to the
same target_ref (kept simple: no granular sharing/permissions
yet — that would need a "workspace" concept which is out of
scope for now).
"""
import sys
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

sys.path.append("..")
from database import get_db_conn
from routers.auth import get_current_user

router = APIRouter()


class AnnotationCreatePayload(BaseModel):
    target_type: str   # 'chart' / 'dataset' / 'report'
    target_ref:  str   # e.g. chart title, dataset filename, report name
    comment_text: str


@router.post("/create")
def create_annotation(payload: AnnotationCreatePayload, user=Depends(get_current_user)):
    if payload.target_type not in ("chart", "dataset", "report"):
        raise HTTPException(400, "target_type must be one of: chart, dataset, report")
    if not payload.comment_text.strip():
        raise HTTPException(400, "Comment cannot be empty")

    try:
        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute("""
            INSERT INTO annotations (user_id, target_type, target_ref, author_name, comment_text)
            VALUES (%s,%s,%s,%s,%s)
            RETURNING id, created_at
        """, (
            user["user_id"], payload.target_type, payload.target_ref,
            user.get("email", "User"), payload.comment_text.strip(),
        ))
        row = cur.fetchone()
        conn.commit()
        conn.close()
        return {
            "success": True,
            "id": row["id"],
            "created_at": row["created_at"].isoformat(),
        }
    except Exception as e:
        raise HTTPException(500, f"Could not save comment: {e}")


@router.get("/list")
def list_annotations(target_type: str, target_ref: str, user=Depends(get_current_user)):
    """List all comments for a given target (e.g. a specific chart title)."""
    try:
        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute("""
            SELECT id, author_name, comment_text, created_at, user_id
            FROM annotations
            WHERE target_type = %s AND target_ref = %s
            ORDER BY created_at ASC
        """, (target_type, target_ref))
        rows = cur.fetchall()
        conn.close()

        for r in rows:
            r["created_at"] = r["created_at"].isoformat()
            r["is_mine"] = (r["user_id"] == user["user_id"])
            del r["user_id"]

        return {"success": True, "annotations": rows}
    except Exception as e:
        raise HTTPException(500, f"Could not load comments: {e}")


@router.delete("/{annotation_id}")
def delete_annotation(annotation_id: int, user=Depends(get_current_user)):
    """Delete a comment — only the author can delete their own."""
    try:
        conn = get_db_conn()
        cur  = conn.cursor()
        cur.execute("""
            DELETE FROM annotations WHERE id = %s AND user_id = %s
        """, (annotation_id, user["user_id"]))
        if cur.rowcount == 0:
            conn.close()
            raise HTTPException(404, "Comment not found or you don't have permission to delete it")
        conn.commit()
        conn.close()
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
