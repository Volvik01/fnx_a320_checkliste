@echo off
title Condor Cabin Manager
cd /d "%~dp0.."

if not exist node_modules (
  echo Installiere Pakete...
  call npm install
)

if not exist node_modules\electron (
  echo Installiere Electron...
  call npm install electron --save-dev
)

if not exist node_modules\node-simconnect (
  echo Installiere SimConnect...
  call npm install node-simconnect
)

echo Starte Condor Cabin Manager...
npx electron electron/main.js
