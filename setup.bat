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

:: -- Check Node.js --
echo [1/4] Checking Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [!] Node.js is NOT installed on this computer!
    echo  [i] Downloading Node.js automatically...
    echo.
    
    set "NODE_URL=https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi"
    set "NODE_INSTALLER=%TEMP%\node-installer.msi"
    
    echo      Downloading from nodejs.org...
    powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing }"
    
    if not exist "!NODE_INSTALLER!" (
        echo.
        echo  [X] Failed to download Node.js.
        echo      Please download manually: https://nodejs.org/en/download
        echo.
        pause
        exit /b 1
    )
    
    echo      Installing Node.js (Admin required)...
    echo      Please wait and click "Next" if a dialog appears...
    msiexec /i "!NODE_INSTALLER!" /passive /norestart
    
    set "PATH=%PATH%;C:\Program Files\nodejs"
    
    where node >nul 2>&1
    if !ERRORLEVEL! NEQ 0 (
        echo.
        echo  [X] Node.js installation failed.
        echo      Please install manually: https://nodejs.org
        echo      Then run this file again.
        pause
        exit /b 1
    )
    
    echo  [OK] Node.js installed successfully!
    del "!NODE_INSTALLER!" >nul 2>&1
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo  [OK] Node.js found: !NODE_VER!
)

echo.

:: -- Install dependencies --
echo [2/4] Installing dependencies (Electron)...
echo      This may take 2-5 minutes on first run...
echo.

cd /d "%~dp0"
call npm install --no-audit --no-fund 2>nul

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  [X] Failed to install dependencies.
    echo      Check your internet connection and try again.
    pause
    exit /b 1
)
echo.
echo  [OK] Dependencies installed!
echo.

:: -- Create Desktop Shortcut --
echo [3/4] Create Desktop shortcut?
echo.
set /p CREATE_SHORTCUT="     Press Y to create, N to skip (Y/N): "

if /i "%CREATE_SHORTCUT%"=="Y" (
    echo.
    echo      Creating shortcut...
    
    set "SHORTCUT_SCRIPT=%TEMP%\create_shortcut.vbs"
    
    (
        echo Set WshShell = WScript.CreateObject^("WScript.Shell"^)
        echo Set shortcut = WshShell.CreateShortcut^(WshShell.SpecialFolders^("Desktop"^) ^& "\TaskFlow AI.lnk"^)
        echo shortcut.TargetPath = "%~dp0start-app.bat"
        echo shortcut.WorkingDirectory = "%~dp0"
        echo shortcut.Description = "TaskFlow AI - Smart Task Scheduler"
        echo shortcut.WindowStyle = 7
        echo shortcut.Save
    ) > "!SHORTCUT_SCRIPT!"
    
    cscript //nologo "!SHORTCUT_SCRIPT!"
    del "!SHORTCUT_SCRIPT!" >nul 2>&1
    
    echo  [OK] Shortcut "TaskFlow AI" created on Desktop!
) else (
    echo  [--] Skipped shortcut creation.
)

echo.

:: -- Create quick launch file --
echo [4/4] Creating quick launch file...

(
    echo @echo off
    echo title TaskFlow AI
    echo cd /d "%%~dp0"
    echo start "" /MIN cmd /c "npm start"
    echo exit
) > "%~dp0start-app.bat"

echo  [OK] "start-app.bat" created!

echo.
echo  ===============================================
echo       SETUP COMPLETE!
echo.
echo       How to run:
echo       - Double-click "start-app.bat"
echo       - Or click "TaskFlow AI" on Desktop
echo  ===============================================
echo.

set /p RUN_NOW="  Run app now? (Y/N): "
if /i "%RUN_NOW%"=="Y" (
    echo.
    echo  Starting TaskFlow AI...
    start "" /MIN cmd /c "cd /d "%~dp0" && npm start"
)

echo.
pause
