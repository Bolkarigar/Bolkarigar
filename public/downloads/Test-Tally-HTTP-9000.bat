@echo off
title BolKarigar - Test Tally HTTP Port 9000
chcp 65001 >nul
echo.
echo ==========================================
echo  Tally HTTP Server test (port 9000)
echo ==========================================
echo.
echo IMPORTANT: ODBC ON is NOT enough!
echo On SAME screen (F1 - Settings - Connectivity - Client/Server):
echo   - TallyPrime acts as = Both
echo   - Enable ODBC Server = Yes
echo   - Enable HTTP Server = Yes   ^(separate line below ODBC^)
echo   - Port = 9000 - Accept - Tally RESTART
echo.
echo Also: Gateway mein company select honi chahiye.
echo.
powershell -NoProfile -Command ^
  "$xml = '<?xml version=\"1.0\"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>'; " ^
  "$ok = $false; foreach ($u in @('http://127.0.0.1:9000','http://localhost:9000')) { try { $r = Invoke-WebRequest -Uri $u -Method POST -Body $xml -ContentType 'text/xml; charset=UTF-8' -TimeoutSec 12 -UseBasicParsing; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500 -and $r.Content -match 'ENVELOPE|RESPONSE|TALLY|COMPANY') { Write-Host ('SUCCESS on ' + $u + ' — Tally HTTP is ON!') -ForegroundColor Green; $ok = $true; break } } catch {} }; " ^
  "if (-not $ok) { try { $t = New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',9000); $t.Close(); Write-Host 'Port 9000 OPEN but HTTP XML failed.' -ForegroundColor Yellow; Write-Host 'Fix: Enable HTTP Server = Yes (NOT only ODBC). Select company in Gateway. Restart Tally.' -ForegroundColor Yellow } catch { Write-Host 'FAIL: Port 9000 closed — Enable HTTP Server + restart Tally.' -ForegroundColor Red } }"
echo.
pause
