@echo off
title Stop Smart Certificate Portal
color 0C

echo ======================================================================
echo   STOPPING SMART CERTIFICATE ALLOCATION PORTAL SERVERS
echo ======================================================================
echo.

powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5000, 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host 'Stopped process on port' $_.LocalPort '(PID ' $_.OwningProcess ')' }"

echo.
echo All portal servers stopped successfully!
timeout /t 2 /nobreak >nul
exit /b 0
