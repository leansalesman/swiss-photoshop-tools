@echo off
title SwissType uninstaller
set "DEST=%APPDATA%\Adobe\CEP\extensions\SwissType"
if exist "%DEST%" (rmdir /s /q "%DEST%" & echo SwissType removed.) else (echo SwissType is not installed.)
echo Your styles and settings stay in Photoshop's panel storage; reinstalling brings them back.
pause
