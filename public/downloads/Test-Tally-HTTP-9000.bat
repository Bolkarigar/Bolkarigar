@echo off
title BolKarigar - Test Tally HTTP Port 9000
chcp 65001 >nul
echo.
echo ==========================================
echo  Tally HTTP Server test (port 9000)
echo ==========================================
echo.
echo Pehle Tally mein:
echo   F1 - Settings - Connectivity
echo   TallyPrime acts as = Both
echo   HTTP Server = Yes, Port 9000 - Accept
echo   Tally RESTART karein (band karke dubara kholo)
echo.
powershell -NoProfile -Command ^
  "$xml = '<?xml version=\"1.0\"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>'; " ^
  "$ok = $false; foreach ($u in @('http://127.0.0.1:9000','http://localhost:9000')) { try { $r = Invoke-WebRequest -Uri $u -Method POST -Body $xml -ContentType 'text/xml' -TimeoutSec 8 -UseBasicParsing; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500 -and $r.Content.Length -gt 5) { Write-Host ('SUCCESS on ' + $u + ' — Tally HTTP is ON!') -ForegroundColor Green; $ok = $true; break } } catch {} }; " ^
  "if (-not $ok) { try { $t = New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',9000); $t.Close(); Write-Host 'Port 9000 OPEN but XML failed — Gateway mein company select karein.' -ForegroundColor Yellow } catch { Write-Host 'FAIL: Port 9000 closed — HTTP Server ON karein + Tally restart.' -ForegroundColor Red } }"
echo.
pause
