@echo off
setlocal
title CIOB GMAO Nexus - Local Host (SQLite)
cd /d "%~dp0..\.."

where node >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Node.js 22+ est requis pour executer CIOB GMAO Nexus.
  echo Telechargez Node.js LTS depuis https://nodejs.org
  pause
  exit /b 1
)

if not exist "dist\index.html" (
  echo [INFO] Compilation de l'interface de production (npm run build)...
  call npm run build
  if errorlevel 1 (
    echo [ERREUR] Echec de la compilation.
    pause
    exit /b 1
  )
)

node "scripts\windows\start-gmao-host.mjs" %*
endlocal
