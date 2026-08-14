[CmdletBinding()]
param(
  [string]$TaskName = "GardenCallCenterAgent",
  [string]$AgentPath = (Join-Path $PSScriptRoot "CallCenterAgent.ps1"),
  [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json")
)

$ErrorActionPreference = "Stop"
$powerShell32 = "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path -LiteralPath $powerShell32)) { throw "32-bit PowerShell was not found: $powerShell32" }
if (-not (Test-Path -LiteralPath $AgentPath)) { throw "Agent was not found: $AgentPath" }
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Config was not found: $ConfigPath" }

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$AgentPath`" -ConfigPath `"$ConfigPath`""
$action = New-ScheduledTaskAction -Execute $powerShell32 -Argument $arguments
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
# Run as SYSTEM so the agent keeps running when no user is logged on (survives logoff/reboot).
# Secrets (FM_CALL_HISTORY_PASSWORD / CALL_INGEST_SECRET) are machine-level env vars, which SYSTEM can read.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Garden FileMaker call history ingest agent (32-bit PowerShell, runs as SYSTEM)" -Force
Write-Host "Registered task: $TaskName (runs as SYSTEM)"
Write-Host "Executable: $powerShell32"
