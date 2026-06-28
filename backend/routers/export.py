import sys
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import List, Any, Dict, Optional

sys.path.append("..")
from engines.export_engine import export_html, export_pdf, export_ppt, export_excel

router = APIRouter()

class ExportPayload(BaseModel):
    report_name: str
    kpis:        Dict[str, Any]
    charts:      List[Dict]
    insights:    List[str]
    format:      str = "html"
    raw_data:    Optional[Dict[str, Any]] = None   # { columns, data } — only used for Excel exports

@router.post("/download")
def download_report(payload: ExportPayload):
    try:
        fmt = payload.format.lower()
        if fmt == "html":
            data = export_html(payload.report_name, payload.kpis, payload.charts, payload.insights)
            mime, filename = "text/html", f"{payload.report_name}.html"
        elif fmt == "pdf":
            data = export_pdf(payload.report_name, payload.kpis, payload.charts, payload.insights)
            mime, filename = "application/pdf", f"{payload.report_name}.pdf"
        elif fmt in ("ppt","pptx"):
            data = export_ppt(payload.report_name, payload.kpis, payload.charts, payload.insights)
            mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            filename = f"{payload.report_name}.pptx"
        elif fmt in ("excel", "xlsx"):
            data = export_excel(payload.report_name, payload.kpis, payload.charts, payload.insights, payload.raw_data)
            mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            filename = f"{payload.report_name}.xlsx"
        else:
            raise HTTPException(400, f"Unknown format: {fmt}")
        return Response(content=data, media_type=mime,
                        headers={"Content-Disposition": f"attachment; filename={filename}"})
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))
