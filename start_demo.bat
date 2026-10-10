@echo off
REM =============================================================================
REM V.E.C.T.O.R — Quick Demo Launcher (Windows)
REM =============================================================================
echo ===================================================================
echo   V.E.C.T.O.R - Velocity Enhanced Clustering ^& Outlier Recognition
echo   Starting Demo Environment...
echo ===================================================================

REM 1. Verify Node.js and Python
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is required but not found in PATH.
    pause
    exit /b 1
)

where python >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python is required but not found in PATH.
    pause
    exit /b 1
)

REM 2. Check if Frontend is built
if not exist "Frontend\dist\index.html" (
    echo [INFO] Building production frontend bundle...
    cd Frontend
    call npm ci
    call npm run build
    cd ..
)

REM 3. Set Environment Defaults
set PORT=3001
set MONGO_URI=mongodb://127.0.0.1:27017
set MONGO_DB_NAME=RedisTransactions
set BITCOIN_SIMULATION_MODE=true
set DEMO_READ_ONLY=true

echo [INFO] Launching unified application server on port 3001...
echo [INFO] Access the dashboard at http://localhost:3001
start http://localhost:3001

cd Frontend
node --env-file=../.env server/index.js
cd ..
