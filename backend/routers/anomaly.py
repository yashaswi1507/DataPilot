import sys
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Any

sys.path.append("..")
from engines.anomaly_engine import detect_anomalies, explain_anomaly

router = APIRouter()

class AnomalyPayload(BaseModel):
    columns:   List[str]
    data:      List[List[Any]]
    method:    str = "iqr"
    threshold: float = 2.5

@router.post("/detect")
def detect(payload: AnomalyPayload):
    try:
        df        = pd.DataFrame(payload.data, columns=payload.columns)
        anomalies = detect_anomalies(df, method=payload.method, threshold=payload.threshold)
        result = {}
        for col, idx_list in anomalies.items():
            explanations = []
            for idx in idx_list[:10]:
                try:
                    explanations.append({"row": int(idx), "value": float(df.loc[idx,col]), "explanation": explain_anomaly(df,col,idx)})
                except Exception:
                    pass
            result[col] = {"count": len(idx_list), "indices": [int(i) for i in idx_list[:50]],
                           "values": [float(df.loc[i,col]) for i in idx_list[:50] if i in df.index],
                           "explanations": explanations}
        return JSONResponse({"success": True, "total": sum(len(v) for v in anomalies.values()),
                             "columns_affected": len(anomalies), "anomalies": result})
    except Exception as e:
        raise HTTPException(500, str(e))
