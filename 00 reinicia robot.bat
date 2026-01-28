@echo off
title Moltbot - Reiniciando...

echo ========================================
echo      MOLTBOT - Reiniciando Servicos
echo ========================================
echo.

echo [INFO] Parando servicos...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [OK] Servicos parados
echo.

echo [INFO] Reiniciando...
call "%~dp0\00 iniciar.bat"
