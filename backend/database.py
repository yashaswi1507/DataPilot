"""
Database connection — PostgreSQL
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Load variables from a .env file in the backend/ directory into the
# process environment. Without this, os.environ.get() below only ever
# sees real system environment variables — it silently ignores .env
# entirely, which is why editing .env had no effect until now.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed — falls back to system env vars / defaults

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
