@echo off
title Iniciar aplicación en puerto 3000

echo ===================================================
echo  Cerrando procesos que usan el puerto 3000...
echo ===================================================

powershell -Command "Get-NetTCPConnection -LocalPort 3000 | Where-Object { $_.OwningProcess -gt 0 } | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo ===================================================
echo  Abriendo navegador en http://localhost:3000
echo ===================================================
start http://localhost:3000

echo.
echo ===================================================
echo  Iniciando servidor con npm start...
echo ===================================================
start cmd /k "npm start"

echo.
echo  Proceso completado. El servidor se ejecuta en la nueva ventana.
timeout /t 2 /nobreak >nul
exit