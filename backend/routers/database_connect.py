"""
External Database Connections — DataPilot
Lets a user connect to their OWN MySQL/PostgreSQL database (not
DataPilot's internal one) and pull a table or query result in as
a dataset, the same way a CSV upload would.

SECURITY NOTE: credentials are received per-request and used to
open a short-lived connection — they are never written to disk
or to DataPilot's own database. The connection is closed
immediately after the query runs. Still, recommend the user
creates a read-only DB user for this rather than using an admin
account.
"""
import sys
from typing import List, Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import pandas as pd
from sqlalchemy import create_engine, text

sys.path.append("..")

router = APIRouter()


class DBConnectionPayload(BaseModel):
    db_type:  str            # 'mysql' or 'postgresql'
    host:     str
    port:     int
    database: str
    username: str
    password: str
    ssl:      bool = False


class DBTestPayload(DBConnectionPayload):
    pass


class DBListTablesPayload(DBConnectionPayload):
    pass


class DBQueryPayload(DBConnectionPayload):
    table_name: Optional[str] = None   # if set, does SELECT * FROM table_name LIMIT 5000
    custom_query: Optional[str] = None # if set, runs this instead (SELECT-only enforced below)
    row_limit: int = 5000


def _build_connection_url(payload: DBConnectionPayload) -> str:
    if payload.db_type not in ("mysql", "postgresql"):
        raise HTTPException(400, "db_type must be 'mysql' or 'postgresql'")

    driver = "pymysql" if payload.db_type == "mysql" else "psycopg2"
    dialect = "mysql" if payload.db_type == "mysql" else "postgresql"

    # URL-encode password to handle special characters safely
    from urllib.parse import quote_plus
    pwd = quote_plus(payload.password)

    url = f"{dialect}+{driver}://{payload.username}:{pwd}@{payload.host}:{payload.port}/{payload.database}"
    if payload.ssl:
        url += "?ssl=true" if payload.db_type == "mysql" else "?sslmode=require"
    return url


def _df_to_dict(df):
    clean_df = df.replace([float("inf"), float("-inf")], None)
    clean_df = clean_df.where(pd.notnull(clean_df), None)
    return {
        "columns": df.columns.astype(str).tolist(),
        "data":    clean_df.values.tolist(),
        "shape":   list(df.shape),
        "dtypes":  {c: str(t) for c, t in df.dtypes.items()},
    }


@router.post("/test")
def test_connection(payload: DBTestPayload):
    """Verify the connection details work before the user commits to anything."""
    try:
        url = _build_connection_url(payload)
        engine = create_engine(url, connect_args={"connect_timeout": 8} if payload.db_type == "postgresql" else {"connect_timeout": 8})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        engine.dispose()
        return {"success": True, "message": "Connection successful!"}
    except Exception as e:
        raise HTTPException(400, f"Connection failed: {str(e)[:300]}")


@router.post("/tables")
def list_tables(payload: DBListTablesPayload):
    """List tables available in the connected database."""
    try:
        url = _build_connection_url(payload)
        engine = create_engine(url, connect_args={"connect_timeout": 8})

        if payload.db_type == "mysql":
            query = "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema = :db"
        else:
            query = """
                SELECT relname AS table_name, n_live_tup AS table_rows
                FROM pg_stat_user_tables ORDER BY relname
            """

        with engine.connect() as conn:
            if payload.db_type == "mysql":
                result = conn.execute(text(query), {"db": payload.database})
            else:
                result = conn.execute(text(query))
            tables = [{"name": row[0], "approx_rows": row[1]} for row in result]

        engine.dispose()
        return {"success": True, "tables": tables}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Could not list tables: {str(e)[:300]}")


def _is_safe_select(query: str) -> bool:
    """Only allow SELECT statements — block writes/DDL for safety."""
    stripped = query.strip().lower()
    if not stripped.startswith("select"):
        return False
    forbidden = ["insert", "update", "delete", "drop", "alter", "create", "truncate", "grant", ";--", "/*"]
    return not any(f in stripped for f in forbidden)


@router.post("/query")
def query_database(payload: DBQueryPayload):
    """
    Pull data in from the external DB — either a whole table (capped
    at row_limit) or a custom SELECT query (writes are blocked).
    """
    if not payload.table_name and not payload.custom_query:
        raise HTTPException(400, "Provide either table_name or custom_query")

    try:
        url = _build_connection_url(payload)
        engine = create_engine(url, connect_args={"connect_timeout": 10})

        if payload.custom_query:
            if not _is_safe_select(payload.custom_query):
                raise HTTPException(400, "Only SELECT queries are allowed (no INSERT/UPDATE/DELETE/DDL).")
            sql = payload.custom_query.rstrip(";")
            sql = f"SELECT * FROM ({sql}) AS subquery LIMIT {min(payload.row_limit, 20000)}"
        else:
            # table_name comes from a dropdown populated by /tables, but
            # still guard against injection via identifier quoting.
            safe_table = payload.table_name.replace('"', '').replace("'", "").replace(";", "")
            sql = f'SELECT * FROM "{safe_table}" LIMIT {min(payload.row_limit, 20000)}' if payload.db_type == "postgresql" \
                  else f"SELECT * FROM `{safe_table}` LIMIT {min(payload.row_limit, 20000)}"

        df = pd.read_sql(sql, engine)
        engine.dispose()

        return {
            "success":  True,
            "filename": payload.table_name or "custom_query_result",
            "raw":      _df_to_dict(df),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Query failed: {str(e)[:400]}")
