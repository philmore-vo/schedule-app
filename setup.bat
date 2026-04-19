@echo off
setlocal enabledelayedexpansion
title TaskFlow AI - Setup
color 0B

echo.
echo  ===============================================
echo       TaskFlow AI - Automatic Setup
echo       Version 1.0.0
echo  ===============================================
echo.

echo [1/4] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  Node.js is NOT installed!
    echo  Downloading Node.js...
    echo.
    set "NODE_URL=https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi"
    set "NODE_INSTALLER=%TEMP%\node-installer.msi"
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '!NODE_URL!' -OutFile '!NODE_INSTALLER!' -UseBasicParsing"
    if not exist "!NODE_INSTALLER!" (
        echo  FAILED to download Node.js.
        echo  Please download from: https://nodejs.org
        goto :end
    )
    echo  Installing Node.js...
    msiexec /i "!NODE_INSTALLER!" /passive /norestart
    set "PATH=%PATH%;C:\Program Files\nodejs"
    del "!NODE_INSTALLER!" >nul 2>&1
    echo  Node.js installed!
) else (
    for /f "tokens=*" %%i in ('node -v') do echo  Node.js found: %%i
)

echo.
echo [2/4] Installing Electron...
echo  This may take a few minutes...
echo.
cd /d "%~dp0"
call npm install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
    echo  FAILED. Check internet and try again.
    goto :end
)
echo.
echo  Dependencies installed!
echo.

echo [3/4] Create Desktop shortcut? (Y/N)
set /p SHORTCUT="  > "
if /i "%SHORTCUT%"=="Y" (
    echo  Creating shortcut...
    powershell -Command " = New-Object -ComObject WScript.Shell;  = .CreateShortcut([Environment]::GetFolderPath('Desktop') + '\TaskFlow AI.lnk'); .TargetPath = '%~dp0start-app.bat'; .WorkingDirectory = '%~dp0'; .WindowStyle = 7; .Save()"
    echo  Shortcut created on Desktop!
)

echo.
echo [4/4] Done!
echo.
echo  ===============================================
echo       SETUP COMPLETE!
echo       Double-click "start-app.bat" to run.
echo  ===============================================
echo.

set /p RUN="  Run app now? (Y/N): "
if /i "%RUN%"=="Y" (
    echo  Starting...
    cd /d "%~dp0"
    call npm start
)

:end
echo.
echo  Press any key to close...
pause >nul