@echo off
chcp 65001 >nul
title TaskFlow AI - Cài đặt tự động
color 0B

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║      🧠 TaskFlow AI - Trình cài đặt         ║
echo  ║      Phiên bản 1.0.0                        ║
echo  ╚══════════════════════════════════════════════╝
echo.

:: ── Kiểm tra Node.js ──
echo [1/4] Đang kiểm tra Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ⚠  Node.js chưa được cài đặt trên máy!
    echo  📥 Đang tải Node.js tự động...
    echo.
    
    :: Tải Node.js LTS installer
    set "NODE_URL=https://nodejs.org/dist/v22.13.1/node-v22.13.1-x64.msi"
    set "NODE_INSTALLER=%TEMP%\node-installer.msi"
    
    echo     Đang tải từ nodejs.org...
    powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%NODE_URL%' -OutFile '%NODE_INSTALLER%' -UseBasicParsing }"
    
    if not exist "%NODE_INSTALLER%" (
        echo.
        echo  ❌ Không thể tải Node.js. Vui lòng tải thủ công:
        echo     https://nodejs.org/en/download
        echo.
        pause
        exit /b 1
    )
    
    echo     Đang cài đặt Node.js (cần quyền Admin)...
    echo     ⏳ Vui lòng chờ và nhấn "Next" nếu có hộp thoại hiện ra...
    msiexec /i "%NODE_INSTALLER%" /passive /norestart
    
    :: Cập nhật PATH
    set "PATH=%PATH%;C:\Program Files\nodejs"
    
    :: Verify
    where node >nul 2>&1
    if %ERRORLEVEL% NEQ 0 (
        echo.
        echo  ❌ Cài đặt Node.js thất bại.
        echo     Vui lòng tải và cài thủ công: https://nodejs.org
        echo     Sau đó chạy lại file này.
        pause
        exit /b 1
    )
    
    echo  ✅ Node.js đã cài thành công!
    del "%NODE_INSTALLER%" >nul 2>&1
) else (
    for /f "tokens=*" %%i in ('node -v') do set NODE_VER=%%i
    echo  ✅ Node.js đã có: %NODE_VER%
)

echo.

:: ── Cài đặt dependencies ──
echo [2/4] Đang cài đặt thư viện (Electron)...
echo     ⏳ Lần đầu có thể mất 2-5 phút, vui lòng chờ...
echo.

cd /d "%~dp0"
call npm install --no-audit --no-fund 2>nul

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ❌ Cài đặt thư viện thất bại.
    echo     Kiểm tra kết nối mạng và thử lại.
    pause
    exit /b 1
)
echo.
echo  ✅ Thư viện đã cài xong!
echo.

:: ── Tạo Desktop Shortcut ──
echo [3/4] Bạn có muốn tạo shortcut trên Desktop không?
echo.
set /p CREATE_SHORTCUT="     Nhấn Y để tạo, N để bỏ qua (Y/N): "

if /i "%CREATE_SHORTCUT%"=="Y" (
    echo.
    echo     Đang tạo shortcut...
    
    :: Tạo file .vbs để tạo shortcut
    set "SHORTCUT_SCRIPT=%TEMP%\create_shortcut.vbs"
    set "APP_DIR=%~dp0"
    
    (
        echo Set WshShell = WScript.CreateObject^("WScript.Shell"^)
        echo Set shortcut = WshShell.CreateShortcut^(WshShell.SpecialFolders^("Desktop"^) ^& "\TaskFlow AI.lnk"^)
        echo shortcut.TargetPath = "%~dp0start-app.bat"
        echo shortcut.WorkingDirectory = "%~dp0"
        echo shortcut.Description = "TaskFlow AI - Smart Task Scheduler"
        echo shortcut.WindowStyle = 7
        echo shortcut.Save
    ) > "%SHORTCUT_SCRIPT%"
    
    cscript //nologo "%SHORTCUT_SCRIPT%"
    del "%SHORTCUT_SCRIPT%" >nul 2>&1
    
    echo  ✅ Shortcut "TaskFlow AI" đã được tạo trên Desktop!
) else (
    echo  ⏭  Bỏ qua tạo shortcut.
)

echo.

:: ── Tạo file khởi chạy nhanh ──
echo [4/4] Đang tạo file khởi chạy nhanh...

(
    echo @echo off
    echo title TaskFlow AI
    echo cd /d "%%~dp0"
    echo start "" /MIN cmd /c "npm start"
    echo exit
) > "%~dp0start-app.bat"

echo  ✅ File "start-app.bat" đã được tạo!

echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║  🎉 CÀI ĐẶT HOÀN TẤT!                     ║
echo  ║                                              ║
echo  ║  Cách chạy app:                              ║
echo  ║  • Click đúp "start-app.bat"                 ║
echo  ║  • Hoặc click "TaskFlow AI" trên Desktop     ║
echo  ╚══════════════════════════════════════════════╝
echo.

set /p RUN_NOW="  Bạn muốn chạy app ngay bây giờ không? (Y/N): "
if /i "%RUN_NOW%"=="Y" (
    echo.
    echo  🚀 Đang khởi chạy TaskFlow AI...
    start "" /MIN cmd /c "cd /d "%~dp0" && npm start"
)

echo.
pause
