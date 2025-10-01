@echo off
echo Starting AI Backend with Auto-Restart...
echo Press Ctrl+C to stop completely
echo.

:start
echo [%TIME%] Starting backend...
node C:\development\dal-ki-1\backend\simple-ai-server.cjs
echo [%TIME%] Backend stopped! Restarting in 3 seconds...
timeout /t 3 /nobreak > nul
goto start
