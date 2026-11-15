@echo off
title Metricool Smart Social Publisher
cd /d "%~dp0"
echo ===================================================
echo   Metricool Smart Social Publisher - Local Server
echo ===================================================
echo.
echo Starting local web server on http://localhost:3000 ...
echo Browser will open automatically in a few seconds.
echo (Press Ctrl+C to stop the server anytime)
echo.

start "" "http://localhost:3000"
npm run start
pause
