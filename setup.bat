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
    echo  Please download from: https://nodejs.org
    echo  Then run this setup again.
    goto :end
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
    set "BATPATH=%~dp0start-app.bat"
    set "ICOPATH=%~dp0assets\icon.ico"
    set "WDIR=%~dp0"
    set "WDIR=!WDIR:~0,-1!"
    echo Set ws = CreateObject^("WScript.Shell"^) > "%TEMP%\mksc.vbs"
    echo Set sc = ws.CreateShortcut^(ws.SpecialFolders^("Desktop"^) ^& "\TaskFlow AI.lnk"^) >> "%TEMP%\mksc.vbs"
    echo sc.TargetPath = "!BATPATH!" >> "%TEMP%\mksc.vbs"
    echo sc.WorkingDirectory = "!WDIR!" >> "%TEMP%\mksc.vbs"
    echo sc.IconLocation = "!ICOPATH!" >> "%TEMP%\mksc.vbs"
    echo sc.WindowStyle = 7 >> "%TEMP%\mksc.vbs"
    echo sc.Save >> "%TEMP%\mksc.vbs"
    cscript //nologo "%TEMP%\mksc.vbs"
    del "%TEMP%\mksc.vbs" >nul 2>&1
    if exist "%USERPROFILE%\Desktop\TaskFlow AI.lnk" (
        echo  Shortcut created on Desktop!
    ) else (
        echo  Could not create shortcut.
    )
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