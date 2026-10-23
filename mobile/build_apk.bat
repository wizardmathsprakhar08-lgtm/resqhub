@echo off
title ResQHub Android APK Cloud Builder (EAS Build)
cd /d "%~dp0"
echo ========================================================
echo   ResQHub — Building Standalone Android APK (.apk)
echo ========================================================
echo.
echo Step 1: Logging in to Expo Application Services...
echo (If you do not have an Expo account, create a free one at https://expo.dev/signup)
echo.
call npx eas-cli login
echo.
echo Step 2: Triggering Cloud Build for Android APK...
echo.
call npx eas-cli build --platform android --profile preview
echo.
echo When build finishes, click the provided download link or scan the QR code to install the APK on your phone!
pause
