import sys, io
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from typing import List, Any

sys.path.append("..")
from engines.preprocessing import DataPreprocessor
from engines.dataset_profiler import DatasetProfiler

router = APIRouter()


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
        return JSONResponse({
            "success":       True,
            "clean": {
                "columns": clean_df.columns.tolist(),
                "data":    clean_df.where(pd.notnull(clean_df), None).values.tolist(),
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
