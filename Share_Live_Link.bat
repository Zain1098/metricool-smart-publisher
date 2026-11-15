@echo off
title Share Metricool Live Link
cd /d "%~dp0"
echo ===================================================
echo   Metricool Smart Social Publisher - Live Sharer
echo ===================================================
echo.
echo Creating an instant public HTTPS live link for port 3000...
echo.
.\cloudflared.exe tunnel --url http://127.0.0.1:3000
pause
