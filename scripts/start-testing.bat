@echo off
echo ============================================
echo  DataPilot - Starting Testing Environment
echo ============================================
echo.

REM Check PostgreSQL service is running before doing anything else.
REM The Windows service name from the official installer is usually
REM "postgresql-x64-18" (or similar with your version number) — this
REM check tries the common name and warns if it's not running.
echo Checking PostgreSQL...
sc query postgresql-x64-18 | findstr "RUNNING" >nul
if %errorlevel% equ 0 (
    echo   PostgreSQL is running.
) else (
    echo   WARNING: Could not confirm PostgreSQL service "postgresql-x64-18" is running.
    echo   If login/signup/scheduled reports/comments fail later, open Services
    echo   (Win+R, type services.msc^), find your PostgreSQL service, and start it.
    echo.
    echo   You can also start it manually with:
    echo     net start postgresql-x64-18
)
echo.

echo This will open 4 windows:
echo   1. Backend server
echo   2. Backend ngrok tunnel
echo   3. Frontend server
echo   4. Frontend ngrok tunnel
echo.
echo Wait for all 4 windows to fully load, then check
echo windows 2 and 4 for the public URLs.
echo.
pause

REM Start backend
start "DataPilot Backend" cmd /k "cd /d %~dp0..\backend && python -m uvicorn main:app --host 0.0.0.0 --port 8001"
timeout /t 3 /nobreak >nul

REM Start backend ngrok tunnel
start "Backend Ngrok" cmd /k "ngrok http 8001"
timeout /t 3 /nobreak >nul

REM Start frontend
start "DataPilot Frontend" cmd /k "cd /d %~dp0..\frontend && npm run dev"
timeout /t 5 /nobreak >nul

REM Start frontend ngrok tunnel
start "Frontend Ngrok" cmd /k "ngrok http 3000"

echo.
echo ============================================
echo All 4 windows started.
echo.
echo IMPORTANT NEXT STEPS:
echo 1. Check the "Backend Ngrok" window for its URL
echo    (looks like https://xxxx.ngrok-free.app)
echo 2. Copy that URL into frontend\.env.local as:
echo    VITE_API_URL=https://xxxx.ngrok-free.app
echo 3. Restart the Frontend window (close it, run
echo    npm run dev again) so it picks up the new URL
echo 4. Check the "Frontend Ngrok" window for ITS URL
echo    - that is the link you share with others
echo ============================================
echo.
echo If you see database connection errors in the Backend
echo window, double-check backend\.env has the correct
echo DB_NAME, DB_USER, and DB_PASSWORD matching what you
echo set up in pgAdmin.
echo ============================================
pause
