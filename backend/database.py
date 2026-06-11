"""
Database connection — PostgreSQL
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

DB_CONFIG = {
    "host":     os.environ.get("DB_HOST",     "localhost"),
    "port":     int(os.environ.get("DB_PORT", "5432")),
    "database": os.environ.get("DB_NAME",     "datapilot"),
    "user":     os.environ.get("DB_USER",     "datapilot_user"),
    "password": os.environ.get("DB_PASSWORD", "StrongPassword123!"),
}


def get_db():
    """Get database connection."""
    conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()


def get_db_conn():
    """Get direct connection (for non-dependency use)."""
    return psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
