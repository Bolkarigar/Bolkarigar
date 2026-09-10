@echo off
title BolKarigar - Test Tally HTTP Port 9000
chcp 65001 >nul
echo.
echo ==========================================
echo  Tally HTTP Server test (port 9000)
echo ==========================================
echo.
echo Pehle Tally mein HTTP Server ON karein:
echo   F1 - Settings - Connectivity - HTTP Server = Yes, Port 9000
echo.
powershell -NoProfile -Command "$r = try { (Invoke-WebRequest -Uri 'http://localhost:9000' -Method POST -Body 'test' -TimeoutSec 5 -UseBasicParsing).StatusCode } catch { 0 }; if ($r -eq 200) { Write-Host 'SUCCESS: Tally HTTP port 9000 is ON!' -ForegroundColor Green } else { Write-Host 'FAIL: Port 9000 not responding. Enable HTTP Server in Tally.' -ForegroundColor Red }"
echo.
pause
