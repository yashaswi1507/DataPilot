import sys, io, math
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import List, Any

sys.path.append("..")
from engines.preprocessing import DataPreprocessor
from engines.dataset_profiler import DatasetProfiler

router = APIRouter()


def _sanitize_value(v):
    """Convert any non-JSON-compliant float (NaN, inf, -inf) to None."""
    if v is None:
        return None
    if isinstance(v, float):
        if math.isnan(v) or math.isinf(v):
            return None
        return v
    try:
        fv = float(v)
        if isinstance(v, (int, str, bool)):
            return v
        if math.isnan(fv) or math.isinf(fv):
            return None
    except (TypeError, ValueError):
        pass
    return v


class DataPayload(BaseModel):
    columns:        List[str]
    data:           List[List[Any]]
    outlier_option: str = "No Action"
    missing_option: str = "Auto"


@router.post("/process")
def process(payload: DataPayload):
    try:
        df              = pd.DataFrame(payload.data, columns=payload.columns)
        profiler        = DatasetProfiler(df)
        dataset_type    = profiler.detect_dataset_type()
        column_profiles = profiler.profile_columns()
        proc            = DataPreprocessor(df, payload.outlier_option, payload.missing_option,
                                           dataset_type, column_profiles)
        clean_df, report = proc.process()
        safe_rows = [[_sanitize_value(v) for v in row] for row in clean_df.values.tolist()]
        return JSONResponse({
            "success":       True,
            "clean": {
                "columns": clean_df.columns.tolist(),
                "data":    safe_rows,
                "shape":   list(clean_df.shape),
            },
            "report":        report,
            "clean_missing": int(clean_df.isnull().sum().sum()),
        })
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/download")
def download_csv(payload: DataPayload):
    try:
        df  = pd.DataFrame(payload.data, columns=payload.columns)
        buf = io.StringIO()
        df.to_csv(buf, index=False)
        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=cleaned_data.csv"},
        )
    except Exception as e:
        raise HTTPException(500, str(e))
