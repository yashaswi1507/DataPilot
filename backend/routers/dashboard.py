import sys
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Any

sys.path.append("..")
from engines.dashboard_generator import generate_kpis, generate_insights

router = APIRouter()

class DashPayload(BaseModel):
    columns: List[str]
    data:    List[List[Any]]

@router.post("/kpis")
def get_kpis(payload: DashPayload):
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)
        return JSONResponse({"success": True, "kpis": generate_kpis(df)})
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/insights")
def get_insights(payload: DashPayload):
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)
        return JSONResponse({"success": True, "insights": generate_insights(df)})
    except Exception as e:
        raise HTTPException(500, str(e))
