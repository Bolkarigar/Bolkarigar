@echo off
title BolKarigar - Test Tally HTTP Port 9000
chcp 65001 >nul
echo.
echo ==========================================
echo  Tally HTTP/XML test (port 9000)
echo ==========================================
echo.
echo TallyPrime mein alag "HTTP Server" line NAHI hoti.
echo Sahi setup:
echo   Alt+Z - Exchange - Configure - Data Synchronisation - Client/Server
echo   - TallyPrime acts as = Server ya Both
echo   - Enable ODBC = Yes
echo   - Port = 9000 - Accept - Tally RESTART
echo   - Company ANDAR load karo ^(Day Book khula ho^)
echo.
echo Galat screen: F1 - Connectivity - Timeout Configuration ^(HTTP log^)
echo.
powershell -NoProfile -Command ^
  "$xml = '<?xml version=\"1.0\"?><ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES></DESC></BODY></ENVELOPE>'; " ^
  "$ok = $false; foreach ($u in @('http://127.0.0.1:9000','http://localhost:9000')) { foreach ($ct in @('UTF-8','text/xml; charset=UTF-8')) { try { $r = Invoke-WebRequest -Uri $u -Method POST -Body $xml -ContentType $ct -TimeoutSec 12 -UseBasicParsing; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500 -and $r.Content -match 'ENVELOPE|RESPONSE|TALLY|COMPANY') { Write-Host ('SUCCESS on ' + $u + ' — Tally XML sync kaam karega!') -ForegroundColor Green; $ok = $true; break } } catch {} }; if ($ok) { break } }; " ^
  "if (-not $ok) { try { $t = New-Object Net.Sockets.TcpClient; $t.Connect('127.0.0.1',9000); $t.Close(); Write-Host 'YELLOW: Port 9000 OPEN par XML jawab nahi aaya.' -ForegroundColor Yellow; Write-Host '  1) Alt+Z - Exchange - Client/Server - Server/Both, ODBC Yes, Port 9000' -ForegroundColor Yellow; Write-Host '  2) Tally restart - Day Book kholo' -ForegroundColor Yellow; Write-Host '  3) EDU version ho to full license se sync zyada reliable hai' -ForegroundColor Yellow; Write-Host '  4) Abhi BolKarigar Khata use karein - HTTP ke bina bills save honge' -ForegroundColor Yellow } catch { Write-Host 'RED: Port 9000 band hai - Exchange - Client/Server setup karein.' -ForegroundColor Red } }"
echo.
pause
