@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install-extension.ps1" %*
set EXITCODE=%ERRORLEVEL%
echo.
if not "%EXITCODE%"=="0" (
  echo Install failed, exit code %EXITCODE%
) else (
  echo Done. In VS Code Command Palette run: Developer: Reload Window
)
pause
exit /b %EXITCODE%
