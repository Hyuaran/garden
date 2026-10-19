[CmdletBinding()]
param(
  [string]$TaskName = "GardenRelayAgent",
  [string]$NodePath = "C:\Program Files\nodejs\node.exe",
  [string]$AgentPath = "",
  [string]$ConfigPath = ""
)
# Windows PowerShell 5.1 で -File 実行すると param の既定値の中では $PSScriptRoot が空になる（2026-10-19 ホスト PC で発生）＝本文で埋める
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $AgentPath) { $AgentPath = Join-Path $scriptDir "agent.mjs" }
if (-not $ConfigPath) { $ConfigPath = Join-Path $scriptDir "config.json" }

$ErrorActionPreference = "Stop"
if ($TaskName -eq "--node") {
  $TaskName = "GardenRelayAgent"
}
if (-not (Test-Path -LiteralPath $NodePath)) { throw "node.exe was not found: $NodePath" }
if (-not (Test-Path -LiteralPath $AgentPath)) { throw "Agent was not found: $AgentPath" }
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Config was not found: $ConfigPath" }

$arguments = "`"$AgentPath`" --config `"$ConfigPath`""
$action = New-ScheduledTaskAction -Execute $NodePath -Argument $arguments -WorkingDirectory (Split-Path -Parent $AgentPath)
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Garden relay agent for INNOVERA and future KOT jobs (runs as SYSTEM)" -Force
Write-Host "Registered task: $TaskName (runs as SYSTEM)"
Write-Host "Executable: $NodePath"
Write-Host "Agent: $AgentPath"
Write-Host "Config: $ConfigPath"
