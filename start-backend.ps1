# PowerShell Auto-Restart Script for AI Backend
Write-Host "Starting AI Backend with Auto-Restart..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop completely" -ForegroundColor Yellow
Write-Host ""

$backendPath = "C:\development\dal-ai-backend\simple-ai-server.cjs"

while ($true) {
    try {
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] Starting backend..." -ForegroundColor Cyan
        
        # Start the backend process
        & node $backendPath
        
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] Backend stopped! Restarting in 3 seconds..." -ForegroundColor Yellow
        Start-Sleep -Seconds 3
    }
    catch {
        Write-Host "Error: $_" -ForegroundColor Red
        Start-Sleep -Seconds 5
    }
}
