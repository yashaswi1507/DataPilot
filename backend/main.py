"""
DataPilot — FastAPI Backend
Deploy on Oracle Cloud VM — no Docker needed.
"""
import os

# Load .env BEFORE importing routers — several routers/modules (database.py,
# auth.py) read os.environ.get(...) for DB credentials and JWT secret at
# import time, so dotenv must run first or those reads silently fall back
# to hardcoded defaults regardless of what's in .env.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import re

from routers import upload, clean, visualize, query, ml, forecast, anomaly, export, dashboard
from routers import auth, userdata, schedule, templates, annotations, database_connect, google_sheets, organizations

# ── Background scheduler (runs scheduled reports every minute) ──
# Requires DB connection — if DB isn't configured locally, scheduler
# will just log errors each tick instead of crashing the whole app.
try:
    from apscheduler.schedulers.background import BackgroundScheduler
    _scheduler = BackgroundScheduler()
except ImportError:
    _scheduler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    if _scheduler:
        _scheduler.add_job(schedule.run_due_schedules, "interval", minutes=1, id="run_due_schedules")
        _scheduler.start()
        print("[scheduler] Started — checking for due reports every minute.")
    yield
    if _scheduler:
        _scheduler.shutdown(wait=False)


app = FastAPI(
    title="DataPilot API",
    description="Smart Data Analysis Backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow React frontend
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Global NaN/Infinity safety net ──────────────────────────────
# Python's default json encoder writes bare NaN/Infinity/-Infinity
# tokens for those float values, which is NOT valid JSON (browsers
# and most JSON parsers reject it). Several routers/engines compute
# pandas results that can contain NaN (e.g. empty groups, division
# by zero) — rather than chase every individual spot, this middleware
# catches anything that slipped through by replacing those bare
# tokens with `null` in the raw response body before it's sent.
from starlette.responses import Response as _StarletteResponse

_NAN_TOKEN_RE = re.compile(rb'(?<![\w"])(-?Infinity|NaN)(?![\w"])')

@app.middleware("http")
async def sanitize_nan_in_responses(request: Request, call_next):
    response = await call_next(request)
    content_type = response.headers.get("content-type", "")
    if "application/json" not in content_type:
        return response

    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    if b"NaN" in body or b"Infinity" in body:
        body = _NAN_TOKEN_RE.sub(b"null", body)

    new_headers = {k: v for k, v in response.headers.items() if k.lower() != "content-length"}
    return _StarletteResponse(
        content=body,
        status_code=response.status_code,
        headers=new_headers,
        media_type=response.media_type,
    )

# Routers
app.include_router(upload.router,    prefix="/api/upload",    tags=["Upload"])
app.include_router(clean.router,     prefix="/api/clean",     tags=["Clean"])
app.include_router(visualize.router, prefix="/api/visualize", tags=["Visualize"])
app.include_router(query.router,     prefix="/api/query",     tags=["Query"])
app.include_router(ml.router,        prefix="/api/ml",        tags=["ML"])
app.include_router(forecast.router,  prefix="/api/forecast",  tags=["Forecast"])
app.include_router(anomaly.router,   prefix="/api/anomaly",   tags=["Anomaly"])
app.include_router(export.router,    prefix="/api/export",    tags=["Export"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["Dashboard"])
app.include_router(schedule.router,  prefix="/api/schedule",  tags=["Scheduled Reports"])
app.include_router(templates.router, prefix="/api/templates", tags=["Dashboard Templates"])
app.include_router(annotations.router, prefix="/api/annotations", tags=["Annotations"])
app.include_router(database_connect.router, prefix="/api/db", tags=["Database Connections"])
app.include_router(google_sheets.router, prefix="/api/sheets", tags=["Google Sheets"])
app.include_router(organizations.router, prefix="/api/organizations", tags=["Organizations"])

# Auth + User data routes
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(userdata.router, prefix="/api/user",     tags=["User Data"])

@app.get("/")
def root():
    return {"message": "DataPilot API is running!", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}
