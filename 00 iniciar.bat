@echo off
title Moltbot Gateway
cd /d "%~dp0"

echo ========================================
echo         MOLTBOT - Assistente IA
echo ========================================
echo.

echo [INFO] Parando instancias anteriores...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [INFO] Iniciando Proxy Base44...
start "Proxy Base44" cmd /k "node proxy-base44.mjs"
timeout /t 3 /nobreak >nul

echo [INFO] Abrindo Chrome...
start "" "chrome" "http://127.0.0.1:18789/?token=meutoken123"

echo.
echo ========================================
echo        Iniciando Moltbot Gateway
echo ========================================
echo.
echo Interface: http://127.0.0.1:18789/?token=meutoken123
echo.

call pnpm dev gateway --port 18789 --verbose
pause
