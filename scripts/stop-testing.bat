@echo off
echo Stopping DataPilot testing environment...
echo.

REM Kill processes on the ports we use
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8001') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Kill ngrok
taskkill /IM ngrok.exe /F >nul 2>&1

echo Done. All servers and tunnels stopped.
pause
