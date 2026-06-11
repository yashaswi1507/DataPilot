import sys
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Any, Dict, Optional

sys.path.append("..")
from engines.ml_engine import train_prediction_model, predict_single, detect_task_type

router = APIRouter()

# In-memory model store
_models: Dict[str, Any] = {}


class MLPayload(BaseModel):
    columns: List[str]
    data:    List[List[Any]]
    target:  str


class PredictPayload(BaseModel):
    columns:      List[str]
    data:         List[List[Any]]
    target:       str
    input_values: Dict[str, Any]


@router.post("/train")
def train(payload: MLPayload):
    try:
        df     = pd.DataFrame(payload.data, columns=payload.columns)
        result = train_prediction_model(df, payload.target)

        if result.get("error"):
            return JSONResponse({"success": False, "error": result["error"]})

        model_id = f"{payload.target}_{len(df)}"
        _models[model_id] = result

        return JSONResponse({
            "success":           True,
            "model_id":          model_id,
            "task_type":         result["task_type"],
            "best_model_name":   result["best_model_name"],
            "metrics":           result["metrics"],
            "feature_importance":result["feature_importance"][:10],
            "model_comparison":  result["model_comparison"],
            "feature_names":     result["feature_names"],
            "n_train":           result["n_train"],
            "n_test":            result["n_test"],
        })
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/predict")
def predict(payload: PredictPayload):
    try:
        df       = pd.DataFrame(payload.data, columns=payload.columns)
        model_id = f"{payload.target}_{len(df)}"

        if model_id not in _models:
            raise HTTPException(400, "Model not trained. Call /api/ml/train first.")

        result     = _models[model_id]
        prediction = predict_single(result, payload.input_values)

        # Interpretation
        col_data = df[payload.target].dropna()
        interp   = {}
        if result["task_type"] == "regression":
            try:
                pred_val  = float(prediction)
                col_min   = float(col_data.min())
                col_max   = float(col_data.max())
                col_mean  = float(col_data.mean())
                col_range = col_max - col_min
                percentile = float((col_data < pred_val).mean() * 100)
                if col_range > 0:
                    zone = "Low" if pred_val <= col_min + col_range*0.33 else (
                           "High" if pred_val >= col_min + col_range*0.67 else "Medium")
                else:
                    zone = "Medium"
                interp = {
                    "zone": zone, "percentile": round(percentile, 1),
                    "col_min": round(col_min, 2), "col_max": round(col_max, 2),
                    "col_mean": round(col_mean, 2),
                }
            except Exception:
                pass

        return JSONResponse({
            "success":        True,
            "prediction":     str(prediction),
            "task_type":      result["task_type"],
            "interpretation": interp,
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, str(e))


@router.post("/suggest-target")
def suggest_target(payload: MLPayload):
    try:
        df         = pd.DataFrame(payload.data, columns=payload.columns)
        candidates = []
        for col in df.columns:
            s        = df[col].dropna()
            miss_pct = df[col].isnull().mean()
            if miss_pct > 0.4 or s.nunique() <= 1:
                continue
            score   = 0
            col_idx = df.columns.tolist().index(col)
            if col_idx == len(df.columns) - 1:
                score += 30
            if pd.api.types.is_numeric_dtype(s):
                if (s == s.round()).mean() >= 0.85 and (s.max()-s.min()) <= 300:
                    score += 30
                cv = abs(s.std()/s.mean()) if s.mean() != 0 else 0
                if 0.1 < cv < 2.0:
                    score += 20
            else:
                if 2 <= s.nunique() <= 10:
                    score += 30
            candidates.append((col, score))

        candidates.sort(key=lambda x: x[1], reverse=True)
        best = candidates[0][0] if candidates else df.columns[-1]
        return JSONResponse({"success": True, "suggested": best})
    except Exception as e:
        raise HTTPException(500, str(e))
