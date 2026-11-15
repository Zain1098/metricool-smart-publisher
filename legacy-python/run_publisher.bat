@echo off
TITLE ZCodeDev Social Publisher Launcher
COLOR 0B
echo ==========================================================
echo        ZCodeDev Social Publisher (Windows Launcher)
echo ==========================================================
echo [1/3] Navigating to project directory: %~dp0
cd /d "%~dp0"

echo [2/3] Checking Python virtual environment...
if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found in .venv.
    echo Please run: python -m venv .venv ^&^& .venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

echo [3/3] Starting Local Dashboard and Background Scheduler...
echo ----------------------------------------------------------
echo  * Local Dashboard:  http://127.0.0.1:8000
echo  * Logging to:       logs\publisher.log
echo  * Press CTRL+C to stop services cleanly.
echo ----------------------------------------------------------

REM The dashboard runs the background scheduler internally (single-instance locked).
"%~dp0.venv\Scripts\python.exe" -m uvicorn app:app --host 127.0.0.1 --port 8000
pause
