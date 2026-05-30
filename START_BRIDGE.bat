@echo off
echo ╔══════════════════════════════════════╗
echo ║   FENIX L-VAR BRIDGE                 ║
echo ║   Verbindet App mit MSFS             ║
echo ╚══════════════════════════════════════╝
echo.
echo Zuerst MSFS starten, dann dieses Fenster offen lassen!
echo.
cd /d "%~dp0bridge"
if not exist "node_modules" ( npm install )
node bridge.js
pause
