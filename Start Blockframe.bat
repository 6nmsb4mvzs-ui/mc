@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if not errorlevel 1 goto check_electron

echo Node.js is required. Install it from https://nodejs.org
echo.
pause
exit /b 1

:check_electron
if exist node_modules\electron\dist\electron.exe goto use_electron
echo Installing dependencies (first run only)...
call npm install --no-fund --no-audit
if errorlevel 1 goto use_server

:use_electron
echo Starting Blockframe Skin Studio...
npx electron .
goto stopped

:use_server
echo Starting in browser mode...
node server.js
goto stopped

:stopped
echo.
echo Blockframe has stopped.
pause
