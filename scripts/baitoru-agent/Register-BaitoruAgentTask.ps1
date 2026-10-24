[CmdletBinding()]
param(
 [string]$TaskName = "GardenBaitoruAgent",
 [string]$NodePath = "C:\Program Files\nodejs\node.exe",
 [string]$AgentPath = "",
 [string]$ConfigPath = ""
)
$ErrorActionPreference = "Stop"
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $AgentPath) { $AgentPath = Join-Path $scriptDir "agent.mjs" }
if (-not $ConfigPath) { $ConfigPath = Join-Path $scriptDir "config.json" }
foreach ($file in @($NodePath, $AgentPath, $ConfigPath)) {
 if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "File not found: $file" }
}
$arguments = "`"$AgentPath`" --once --config `"$ConfigPath`""
$action = New-ScheduledTaskAction -Execute $NodePath -Argument $arguments -WorkingDirectory (Split-Path -Parent $AgentPath)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 10)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 9) -MultipleInstances IgnoreNew -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Garden Baitoru CSV import every 10 minutes" -Force
Write-Host "Registered task: $TaskName (SYSTEM, every 10 minutes)"
