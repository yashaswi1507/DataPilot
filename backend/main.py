"""
DataPilot — FastAPI Backend
Deploy on Oracle Cloud VM — no Docker needed.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from routers import upload, clean, visualize, query, ml, forecast, anomaly, export, dashboard
from routers import auth, userdata

app = FastAPI(
    title="DataPilot API",
    description="Smart Data Analysis Backend",
    version="1.0.0",
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

# Auth + User data routes
app.include_router(auth.router,     prefix="/api/auth",     tags=["Auth"])
app.include_router(userdata.router, prefix="/api/user",     tags=["User Data"])

@app.get("/")
def root():
    return {"message": "DataPilot API is running!", "version": "1.0.0"}

@app.get("/health")
def health():
    return {"status": "ok"}
