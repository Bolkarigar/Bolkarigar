@echo off
title Accounts Orbit Tally Sync Agent
cd /d "%~dp0"
if exist BolKarigarTallyAgent.exe (
  BolKarigarTallyAgent.exe
) else (
  echo Running with Node.js...
  node BolKarigarTallyAgent.js
)
pause
