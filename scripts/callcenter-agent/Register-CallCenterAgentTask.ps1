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
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Description "Garden FileMaker call history ingest agent (32-bit PowerShell)" -Force
Write-Host "Registered task: $TaskName"
Write-Host "Executable: $powerShell32"
