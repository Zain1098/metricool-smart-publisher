@echo off
title ZCodeDev Social Publisher Launcher
cd /d "%~dp0"

echo ============================================================
echo        ZCodeDev Social Publisher - Desktop Launcher
echo ============================================================
echo.

:: Check if server is already running on port 8000
curl.exe -s http://127.0.0.1:8000/api/system/status >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Publisher server is already running!
    start http://127.0.0.1:8000
    exit /b 0
)

echo [*] Starting Publisher server...
start /min "" .venv\Scripts\python.exe -m uvicorn app:app --host 127.0.0.1 --port 8000

echo [*] Waiting for server startup...
timeout /t 2 /nobreak >nul

echo [*] Opening Web Studio in browser...
start http://127.0.0.1:8000

exit /b 0
