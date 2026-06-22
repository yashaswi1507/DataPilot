import sys, os, pickle, uuid, re
import pandas as pd
import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Any, Dict, Optional

sys.path.append("..")
from engines.ml_engine import train_prediction_model, predict_single, detect_task_type

router = APIRouter()

# In-memory model store (session-scoped, used for /predict right after /train)
_models: Dict[str, Any] = {}

# Where saved models live on disk — survives across sessions, organized
# by a random model_id (no user folders yet since this doesn't require
# login; could be namespaced under user_id later if needed).
SAVED_MODELS_DIR = os.path.join(os.path.dirname(__file__), "..", "saved_models")
os.makedirs(SAVED_MODELS_DIR, exist_ok=True)


class MLPayload(BaseModel):
    columns: List[str]
    data:    List[List[Any]]
    target:  str


class PredictPayload(BaseModel):
    columns:      List[str]
    data:         List[List[Any]]
    target:       str
    input_values: Dict[str, Any]


class SaveModelPayload(BaseModel):
    columns: List[str]
    data:    List[List[Any]]
    target:  str
    model_name: Optional[str] = None


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
            "why_best_model":    result.get("why_best_model", ""),
            "metrics":           result["metrics"],
            "feature_importance":result["feature_importance"][:10],
            "model_comparison":  result["model_comparison"],
            "sample_predictions":result.get("sample_predictions", []),
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


@router.post("/recommendations")
def get_recommendations(payload: MLPayload):
    """Returns dataset-specific recommendations for the Dashboard card."""
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)

        # 1. Suggest target column (reuse logic)
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
            candidates.append((col, score, pd.api.types.is_numeric_dtype(s), s.nunique() if not pd.api.types.is_numeric_dtype(s) else None))

        candidates.sort(key=lambda x: x[1], reverse=True)
        target_col   = candidates[0][0] if candidates else (df.columns[-1] if len(df.columns) else None)
        is_numeric   = candidates[0][2] if candidates else True
        task         = "Regression" if is_numeric else "Classification"

        # 2. Recommended model based on task + data size
        n_rows = len(df)
        if task == "Regression":
            model = "Random Forest" if n_rows > 200 else "Linear Regression"
        else:
            model = "Random Forest" if n_rows > 200 else "Logistic Regression"

        # 3. Detect date/forecasting column
        date_col = None
        for col in df.columns:
            if "date" in col.lower() or "time" in col.lower():
                date_col = col
                break
            try:
                parsed = pd.to_datetime(df[col].dropna().head(20), errors="coerce")
                if parsed.notna().mean() > 0.8:
                    date_col = col
                    break
            except Exception:
                continue

        # 4. Dataset type detection
        numeric_count = sum(pd.api.types.is_numeric_dtype(df[c]) for c in df.columns)
        cat_count     = len(df.columns) - numeric_count
        if date_col and numeric_count >= 2:
            dataset_type = "Time Series / Business"
        elif numeric_count > cat_count:
            dataset_type = "Numerical / Business"
        elif cat_count > numeric_count:
            dataset_type = "Categorical"
        else:
            dataset_type = "Mixed / Tabular"

        # 5. Data quality score — same formula as dataset_profiler.py for consistency
        missing_pct  = df.isnull().sum().sum() / (df.shape[0] * df.shape[1]) if df.shape[0] and df.shape[1] else 0
        dup_pct      = df.duplicated().sum() / max(len(df), 1)
        worst_col_missing = (df.isnull().mean().max()) if df.shape[1] else 0
        penalty      = (missing_pct*100*2.5) + (dup_pct*100*2.0) + (worst_col_missing*100*0.5)
        quality      = max(0, min(100, round(100 - penalty)))
        quality_label= "Excellent" if quality >= 90 else "Good" if quality >= 75 else "Fair" if quality >= 50 else "Poor"

        return JSONResponse({
            "success": True,
            "recommended_target":   target_col,
            "recommended_task":     task,
            "recommended_model":    model,
            "forecasting_column":   date_col or "Not detected",
            "dataset_type":         dataset_type,
            "data_quality":         quality,
            "data_quality_label":   quality_label,
        })
    except Exception as e:
        raise HTTPException(500, str(e))


# ── Save & download trained model ───────────────────────────────

@router.post("/save-model")
def save_model(payload: SaveModelPayload):
    """
    Trains (or re-trains, since we don't persist the in-memory model
    across server restarts) the model for this target, then pickles
    it to disk along with everything needed to use it later: the
    feature schema, encoders, scaler, and imputer. Returns a model_id
    the frontend can use to download the .pkl or call /predict-saved.
    """
    try:
        df     = pd.DataFrame(payload.data, columns=payload.columns)
        result = train_prediction_model(df, payload.target)

        if result.get("error"):
            raise HTTPException(400, result["error"])

        model_id = str(uuid.uuid4())[:12]
        bundle = {
            "model":           result["model"],
            "task_type":       result["task_type"],
            "best_model_name": result["best_model_name"],
            "feature_names":   result["feature_names"],
            "target_column":   payload.target,
            "label_encoders":  result["label_encoders"],
            "target_encoder":  result["target_encoder"],
            "scaler":          result["scaler"],
            "imputer":         result["imputer"],
            "metrics":         result["metrics"],
        }

        file_path = os.path.join(SAVED_MODELS_DIR, f"{model_id}.pkl")
        with open(file_path, "wb") as f:
            pickle.dump(bundle, f)

        # Keep it in the in-memory predict cache too, keyed the same way
        # /predict already expects, so existing predict flow keeps working.
        predict_cache_key = f"{payload.target}_{len(df)}"
        _models[predict_cache_key] = result

        return JSONResponse({
            "success":  True,
            "model_id": model_id,
            "model_name": payload.model_name or f"{result['best_model_name']} — {payload.target}",
            "download_url": f"/api/ml/download-model/{model_id}",
            "message": f"Model saved! {result['best_model_name']} trained to predict '{payload.target}'.",
        })
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Could not save model: {e}")


@router.get("/download-model/{model_id}")
def download_model(model_id: str):
    """Download the saved .pkl file."""
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", model_id)
    file_path = os.path.join(SAVED_MODELS_DIR, f"{safe_id}.pkl")
    if not os.path.exists(file_path):
        raise HTTPException(404, "Model not found. It may have been saved on a different server instance.")
    return FileResponse(file_path, media_type="application/octet-stream", filename=f"datapilot_model_{safe_id}.pkl")


@router.post("/predict-saved/{model_id}")
def predict_with_saved_model(model_id: str, input_values: Dict[str, Any]):
    """
    Run a prediction using a previously saved model (loaded from disk),
    without needing the original dataset in the request — this is what
    an external app would call via the model's API endpoint.
    """
    safe_id = re.sub(r"[^a-zA-Z0-9_-]", "", model_id)
    file_path = os.path.join(SAVED_MODELS_DIR, f"{safe_id}.pkl")
    if not os.path.exists(file_path):
        raise HTTPException(404, "Model not found.")

    try:
        with open(file_path, "rb") as f:
            bundle = pickle.load(f)

        prediction = predict_single(bundle, input_values)
        return JSONResponse({
            "success":    True,
            "prediction": str(prediction),
            "task_type":  bundle["task_type"],
            "target":     bundle["target_column"],
        })
    except Exception as e:
        raise HTTPException(500, f"Prediction failed: {e}")
