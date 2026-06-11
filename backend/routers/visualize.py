import sys
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Any, Optional

router = APIRouter()

class VizPayload(BaseModel):
    columns:    List[str]
    data:       List[List[Any]]
    chart_type: str
    x_col:      Optional[str] = None
    y_col:      Optional[str] = None
    group_col:  Optional[str] = None
    agg_func:   str = "mean"
    top_n:      int = 15

@router.post("/chart-data")
def get_chart_data(payload: VizPayload):
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)
        if payload.chart_type == "bar":
            g = df.groupby(payload.x_col)[payload.y_col].agg(payload.agg_func).reset_index()
            g = g.sort_values(payload.y_col, ascending=False).head(payload.top_n)
            return JSONResponse({"labels": g[payload.x_col].tolist(), "values": [round(float(v),2) for v in g[payload.y_col]]})
        elif payload.chart_type == "histogram":
            s = df[payload.x_col].dropna()
            counts, edges = np.histogram(s, bins=25)
            return JSONResponse({"bins": [round(float(e),2) for e in edges[:-1]], "counts": counts.tolist()})
        elif payload.chart_type == "scatter":
            sample = df[[payload.x_col, payload.y_col]].dropna().sample(min(500,len(df)), random_state=42)
            return JSONResponse({"x": [round(float(v),4) for v in sample[payload.x_col]], "y": [round(float(v),4) for v in sample[payload.y_col]]})
        elif payload.chart_type == "pie":
            vc = df[payload.x_col].value_counts().head(payload.top_n)
            return JSONResponse({"labels": vc.index.tolist(), "values": vc.values.tolist()})
        elif payload.chart_type == "correlation":
            num_cols = df.select_dtypes(include="number").columns.tolist()
            corr = df[num_cols].corr().round(2)
            return JSONResponse({"columns": num_cols, "matrix": corr.values.tolist()})
        else:
            raise HTTPException(400, f"Unknown chart type: {payload.chart_type}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/summary")
def get_summary(payload: VizPayload):
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)
        return JSONResponse({
            "describe": df.select_dtypes(include="number").describe().round(2).to_dict(),
            "missing":  {k: int(v) for k,v in df.isnull().sum().items()},
            "shape":    list(df.shape),
            "dtypes":   {c: str(t) for c,t in df.dtypes.items()},
        })
    except Exception as e:
        raise HTTPException(500, str(e))
