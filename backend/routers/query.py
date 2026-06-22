import sys
import pandas as pd
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Any

sys.path.append("..")
from engines.query_engine import parse_query, execute_query, generate_query_insight

router = APIRouter()


class QueryPayload(BaseModel):
    columns: List[str]
    data:    List[List[Any]]
    query:   str


def _translate_to_english(text: str) -> str:
    """Detect language and translate to English if needed. Falls back to original text on any failure."""
    try:
        from deep_translator import GoogleTranslator
        # Quick heuristic: if text is mostly ASCII letters, skip translation call (faster, avoids rate limits)
        non_ascii_ratio = sum(1 for c in text if ord(c) > 127) / max(len(text), 1)
        if non_ascii_ratio < 0.1:
            return text
        translated = GoogleTranslator(source="auto", target="en").translate(text)
        return translated or text
    except Exception:
        return text


@router.post("/run")
def run_query(payload: QueryPayload):
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)
        query_en   = _translate_to_english(payload.query)
        op, target, group = parse_query(query_en, df)
        result_dict = execute_query(df, op, target, group)
        insights    = generate_query_insight(result_dict, target, group)

        result = result_dict.get("result")
        if isinstance(result, pd.Series):
            result_data = {
                "type":   "series",
                "index":  [str(i) for i in result.index.tolist()],
                "values": [float(v) if pd.notnull(v) else None for v in result.values],
            }
        elif result is not None:
            try:
                result_data = {"type": "scalar", "value": float(result)}
            except Exception:
                result_data = {"type": "scalar", "value": str(result)}
        else:
            result_data = None

        return JSONResponse({
            "success":    not bool(result_dict.get("error")),
            "error":      result_dict.get("error"),
            "result":     result_data,
            "query_desc": result_dict.get("query_desc", ""),
            "insights":   insights,
            "op":         op,
            "target":     target,
            "group":      group,
        })
    except Exception as e:
        raise HTTPException(500, str(e))
