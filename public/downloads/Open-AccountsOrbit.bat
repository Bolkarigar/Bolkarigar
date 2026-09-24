@echo off
set URL=https://bolkarigar.onrender.com/loginpage.html
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --window-size=1360,860
  goto :eof
)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" --app="%URL%" --window-size=1360,860
  goto :eof
)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" --app="%URL%" --window-size=1360,860
  goto :eof
)
start "" "%URL%"
