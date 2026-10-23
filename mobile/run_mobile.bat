@echo off
title ResQHub Mobile Application
cd /d "%~dp0"
echo ========================================================
echo   Launching ResQHub Mobile App (Expo SDK 57)
echo ========================================================
echo.
echo Instructions:
echo  - Scan the QR code below with Expo Go on Android
echo  - Press 'a' to launch on connected Android device/emulator
echo  - Press 'r' to reload application
echo.
npx expo start
pause
