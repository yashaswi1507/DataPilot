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


@router.post("/run")
def run_query(payload: QueryPayload):
    try:
        df = pd.DataFrame(payload.data, columns=payload.columns)
        op, target, group = parse_query(payload.query, df)
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
