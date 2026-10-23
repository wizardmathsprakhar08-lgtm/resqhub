@echo off
title ResQHub Backend & Web Command Center
cd /d "%~dp0"
echo ========================================================
echo   Starting ResQHub Emergency Server & Web Portal
echo ========================================================
echo.
echo Local Web Dashboard:  http://localhost:8000/dashboard
echo Interactive API Docs: http://localhost:8000/api/v1/docs
echo Health Check:         http://localhost:8000/api/v1/health
echo.
echo Server listening on 0.0.0.0:8000 for LAN & Mobile access...
echo Press CTRL+C to terminate the server.
echo.
start http://localhost:8000/dashboard
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
