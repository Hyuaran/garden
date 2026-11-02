@echo off
chcp 65001 >nul
cd /d C:\garden\a-bloom-008
if errorlevel 1 exit /b 1
>>scripts\manual-gate\watch-manuals.log echo [%date% %time%] START
node scripts\manual-gate\watch-manuals.mjs >>scripts\manual-gate\watch-manuals.log 2>&1
set "watch_result=%errorlevel%"
>>scripts\manual-gate\watch-manuals.log echo [%date% %time%] END exit=%watch_result%
exit /b %watch_result%
