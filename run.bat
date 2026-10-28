@echo off
title Smart Certificate Allocation Portal
color 0B

echo ======================================================================
echo   SMART CERTIFICATE ALLOCATION ^& VERIFICATION PORTAL
echo   React + Vite + Tailwind CSS ^| Node.js + Express ^| MongoDB Dual-Engine
echo ======================================================================
echo.

:: 1. Check Node.js installation
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on your system!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

:: 2. Ensure Backend Dependencies
if not exist "%~dp0backend\node_modules" (
    echo [INFO] Installing backend dependencies...
    cd /d "%~dp0backend"
    call npm install
    cd /d "%~dp0"
)

:: 3. Ensure Frontend Dependencies
if not exist "%~dp0frontend\node_modules" (
    echo [INFO] Installing frontend dependencies...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
)

:: 4. Ensure Demo Artifacts Exist
if not exist "%~dp0backend\sample_data\certificates.zip" (
    echo [INFO] Generating sample certificates and participant CSV...
    cd /d "%~dp0backend"
    node src/scripts/generateDemoData.js
    cd /d "%~dp0"
)

echo.
echo [1/3] Starting Backend Server on port 5000...
start "CertAlloc - Backend Server (Port 5000)" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo [2/3] Starting Frontend Dev Server on port 5173...
start "CertAlloc - Frontend Client (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo [3/3] Waiting for servers to initialize...
timeout /t 3 /nobreak >nul

:: 5. Launch Browser
echo Opening application in default web browser...
start http://localhost:5173

echo.
echo ======================================================================
echo   APP IS RUNNING SUCCESSFULLY!
echo ======================================================================
echo   - Frontend Portal:    http://localhost:5173
echo   - Backend API:        http://localhost:5000/api/health
echo   - Participant Portal: http://localhost:5173/portal
echo.
echo   ADMIN DEFAULT CREDENTIALS:
echo   - Username: admin
echo   - Password: Admin@SmartCert2026
echo.
echo   To stop the servers, simply close the opened Backend and Frontend
echo   command prompt windows.
echo ======================================================================
echo.
pause
