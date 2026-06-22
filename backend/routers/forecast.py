import sys
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Any, Optional

sys.path.append("..")
from engines.timeseries_engine import detect_timeseries_cols, prepare_series, forecast, confidence_interval

router = APIRouter()

class ForecastPayload(BaseModel):
    columns:    List[str]
    data:       List[List[Any]]
    value_col:  str
    date_col:   Optional[str] = None
    periods:    int = 30
    confidence: str = "95%"

@router.post("/run")
def run_forecast(payload: ForecastPayload):
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)
        date_col, _ = detect_timeseries_cols(df)
        if payload.date_col:
            date_col = payload.date_col

        # If no date column detected/provided, create a synthetic integer index
        # so any numeric series (e.g. health metrics, sales without dates) can
        # still be forecasted. The x-axis will show "Period 1, 2, 3..." instead
        # of real dates, but the trend/forecast math is identical.
        if not date_col:
            df["__period__"] = range(1, len(df) + 1)
            date_col = "__period__"
        ts, freq      = prepare_series(df, date_col, payload.value_col)
        result, error = forecast(ts, periods=payload.periods, freq=freq)
        if error:
            return JSONResponse({"success": False, "error": error})
        fcp          = result["forecast"]
        ci_pct       = 0.95 if payload.confidence == "95%" else 0.90
        upper, lower = confidence_interval(ts, fcp, ci_pct)
        return JSONResponse({
            "success":      True,
            "model":        result["name"],
            "historical":   {"dates": [str(d) for d in ts.index], "values": [round(float(v),4) for v in ts.values]},
            "forecast":     {"dates": [str(d) for d in fcp.index], "values": [round(float(v),4) for v in fcp.values],
                             "upper": [round(float(v),4) for v in upper.values], "lower": [round(float(v),4) for v in lower.values]},
            "last_known":   round(float(ts.iloc[-1]),4),
            "forecast_end": round(float(fcp.iloc[-1]),4),
            "delta":        round(float(fcp.iloc[-1]-ts.iloc[-1]),4),
        })
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/detect-cols")
def detect_cols(payload: ForecastPayload):
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)
        date_col, value_cols = detect_timeseries_cols(df)
        return JSONResponse({"date_col": date_col, "value_cols": value_cols})
    except Exception as e:
        raise HTTPException(500, str(e))
