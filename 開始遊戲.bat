@echo off
chcp 65001 >nul
title 鋼鐵擂台
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 找不到 Node.js，請先安裝：https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo 首次啟動，正在安裝依賴...
  call npm install
  if errorlevel 1 (
    echo 安裝失敗。
    pause
    exit /b 1
  )
)

powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 1; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }"
if %errorlevel%==0 (
  echo 伺服器已在運行，直接開啟遊戲...
  start "" "http://localhost:5173/"
  exit /b 0
)

echo 啟動中，瀏覽器即將開啟...
echo 關閉此視窗即停止遊戲伺服器。
echo.
call npm run dev
