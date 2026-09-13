[CmdletBinding()]
param(
  [string]$TaskName = "GardenShineigyoSnapshot",
  [string]$AgentPath,
  [string]$ConfigPath
)

$ErrorActionPreference = "Stop"
# $PSScriptRoot is empty inside param defaults when run with -File on Windows PowerShell 5.1, so resolve the folder here.
$scriptFolder = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $AgentPath) { $AgentPath = Join-Path $scriptFolder "ShineigyoSnapshot.ps1" }
if (-not $ConfigPath) { $ConfigPath = Join-Path $scriptFolder "config.json" }
$powerShell32 = "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
if (-not (Test-Path -LiteralPath $powerShell32)) { throw "32-bit PowerShell was not found: $powerShell32" }
if (-not (Test-Path -LiteralPath $AgentPath)) { throw "Agent was not found: $AgentPath" }
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Config was not found: $ConfigPath" }

$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$AgentPath`" -ConfigPath `"$ConfigPath`" -Once"
$action = New-ScheduledTaskAction -Execute $powerShell32 -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Daily -At 5:30
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
# Run as SYSTEM so the snapshot works without an interactive logon.
# Secrets (FM_CALL_HISTORY_PASSWORD / CALL_INGEST_SECRET) are machine-level env vars, which SYSTEM can read.
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Garden FileMaker shineigyo daily snapshot (32-bit PowerShell, runs as SYSTEM)" -Force
Write-Host "Registered task: $TaskName (runs as SYSTEM)"
Write-Host "Executable: $powerShell32"
