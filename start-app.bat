@echo off
title TaskFlow AI
cd /d "%~dp0"

:: Check if node_modules exists
if not exist "node_modules" (
    echo Installing dependencies first...
    call npm install --no-audit --no-fund
    echo.
)

:: Run Electron app
call npm start
