@echo off
title Moltbot - Parando...

echo ========================================
echo         MOLTBOT - Parando Servicos
echo ========================================
echo.

echo [INFO] Parando todos os processos Node.js...
taskkill /F /IM node.exe >nul 2>&1

echo.
echo [OK] Moltbot e Proxy Base44 parados!
echo.

timeout /t 3 >nul
