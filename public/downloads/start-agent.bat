@echo off
title Accounts Orbit Tally Sync Agent
cd /d "%~dp0"
set "AGENT_CMD="
if exist AccountsOrbitTallyAgent.exe set "AGENT_CMD=AccountsOrbitTallyAgent.exe"
if not defined AGENT_CMD if exist BolKarigarTallyAgent.exe set "AGENT_CMD=BolKarigarTallyAgent.exe"
if not defined AGENT_CMD if exist AccountsOrbitTallyAgent.js set "AGENT_CMD=node AccountsOrbitTallyAgent.js"
if not defined AGENT_CMD if exist BolKarigarTallyAgent.js set "AGENT_CMD=node BolKarigarTallyAgent.js"
if not defined AGENT_CMD (
  echo ERROR: AccountsOrbitTallyAgent.exe not found in this folder!
  pause
  exit /b 1
)
%AGENT_CMD%
pause
