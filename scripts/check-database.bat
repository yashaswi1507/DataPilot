@echo off
echo ============================================
echo  DataPilot - Database Connection Check
echo ============================================
echo.

if not exist "%~dp0..\backend\.env" (
    echo ERROR: backend\.env file not found.
    echo Copy backend\.env.example to backend\.env and fill in your
    echo PostgreSQL details before continuing.
    pause
    exit /b 1
)

echo Found backend\.env — here are the DB settings in it:
echo (password is hidden)
echo.
findstr /B "DB_HOST DB_PORT DB_NAME DB_USER" "%~dp0..\backend\.env"
echo.

echo Checking PostgreSQL Windows service...
sc query postgresql-x64-18 | findstr "RUNNING" >nul
if %errorlevel% equ 0 (
    echo   postgresql-x64-18 service: RUNNING
) else (
    echo   postgresql-x64-18 service: NOT RUNNING or not found under that name
    echo   Try: services.msc and look for any service starting with "postgresql"
)
echo.

echo Attempting a test connection with psql...
echo (You may be prompted for the postgres password)
echo.
"C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -d datapilot -c "SELECT 'Connection successful!' as status;"

echo.
echo ============================================
echo If you saw "Connection successful!" above, your database
echo is reachable. If you saw a password or "database does not
echo exist" error, fix backend\.env to match — DB_NAME, DB_USER,
echo and DB_PASSWORD must exactly match what you set up in pgAdmin.
echo ============================================
pause
