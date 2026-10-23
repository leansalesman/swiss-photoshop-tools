@echo off
title SwissGrid installer
echo.
echo  SwissGrid panel installer for Photoshop (Windows)
echo  -------------------------------------------------
echo.
echo  1. Allowing your own (unsigned) panels in Photoshop...
for %%V in (9 10 11 12) do reg add "HKCU\Software\Adobe\CSXS.%%V" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
echo     Done.
echo.
echo  2. Copying SwissGrid to your extensions folder...
set "DEST=%APPDATA%\Adobe\CEP\extensions\SwissGrid"
if exist "%DEST%" rmdir /s /q "%DEST%"
xcopy "%~dp0SwissGrid" "%DEST%\" /E /I /Y /Q >nul
if errorlevel 1 (
  echo     Copy failed. Make sure this .bat is next to the SwissGrid folder.
  pause
  exit /b 1
)
echo     Installed to: %DEST%
echo.
echo  3. Restart Photoshop, then open:
echo     Window ^> Extensions (legacy) ^> SwissGrid
echo.
pause
