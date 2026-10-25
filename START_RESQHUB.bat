@echo off
title ResQHub Emergency Safety & Rapid SOS Platform
cd /d "%~dp0"
echo ======================================================================
echo    🚨 ResQHub — Emergency Safety & Rapid SOS Platform
echo ======================================================================
echo.
echo  [1] Starting Backend Server & Web Command Center on port 8000...
echo  [2] Standalone Android APK: %~dp0ResQHub-Emergency.apk
echo.
echo  Opening Web Command Center: http://localhost:8000/dashboard
echo  Direct APK Download:       http://localhost:8000/apk
echo  Swagger API Documentation: http://localhost:8000/api/v1/docs
echo.
echo  Starting server...
start http://localhost:8000/dashboard
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
pause
