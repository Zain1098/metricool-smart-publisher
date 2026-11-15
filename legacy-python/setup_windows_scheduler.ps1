# ZCodeDev Social Publisher - Windows Task Scheduler Setup Script
# Registers a background startup task with verified project paths and crash restart recovery.

$TaskName = "ZCodeDevSocialPublisher"
$ProjectDir = "D:\Development\Video Post Automation"
$PythonExe = Join-Path $ProjectDir ".venv\Scripts\python.exe"
$SchedulerScript = Join-Path $ProjectDir "src\scheduler.py"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   ZCodeDev Social Publisher - Windows Scheduler Setup    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Project Directory: $ProjectDir"
Write-Host "Python Path:       $PythonExe"
Write-Host "Scheduler Script:  $SchedulerScript"
Write-Host ""

if (-not (Test-Path $PythonExe)) {
    Write-Host "[ERROR] Python executable not found at $PythonExe" -ForegroundColor Red
    exit 1
}

# Define Task Action
$Action = New-ScheduledTaskAction -Execute $PythonExe -Argument "src\scheduler.py" -WorkingDirectory $ProjectDir

# Define Task Trigger (At User Logon)
$Trigger = New-ScheduledTaskTrigger -AtLogOn

# Define Task Settings (Auto-restart on failure, do not stop if running on batteries, execution time limit disabled)
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Days 365) `
    -Priority 7

# Register the Scheduled Task for current logged in user
try {
    # Unregister old task if already present
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger -Settings $Settings -Description "Runs ZCodeDev Social Publisher background scheduler on user logon."
    Write-Host "[SUCCESS] Windows Task '$TaskName' successfully registered!" -ForegroundColor Green
    Write-Host "Task will automatically start on Windows login and monitor queue." -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to register task: $_" -ForegroundColor Red
    Write-Host "Note: If required, run PowerShell as Administrator to register scheduled tasks." -ForegroundColor Yellow
}
