[CmdletBinding()]
param(
  [string]$TaskName = "GardenRelayAgent",
  [string]$NodePath = "C:\Program Files\nodejs\node.exe",
  [string]$AgentPath = (Join-Path $PSScriptRoot "agent.mjs"),
  [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json")
)

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
