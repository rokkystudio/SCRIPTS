@echo off
setlocal

rem Запускает основной скрипт из той же папки, что и этот .bat-файл.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Disable-EdgeDevModeWarning.ps1"
set "exitCode=%ERRORLEVEL%"

if not "%exitCode%"=="0" (
    echo.
    echo Скрипт завершился с кодом %exitCode%.
)

echo.
pause
exit /b %exitCode%
