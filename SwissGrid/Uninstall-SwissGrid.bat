@echo off
title SwissGrid uninstaller
set "DEST=%APPDATA%\Adobe\CEP\extensions\SwissGrid"
if exist "%DEST%" (rmdir /s /q "%DEST%" & echo SwissGrid removed.) else (echo SwissGrid is not installed.)
echo Your presets stay in Photoshop's panel storage; reinstalling brings them back.
pause
