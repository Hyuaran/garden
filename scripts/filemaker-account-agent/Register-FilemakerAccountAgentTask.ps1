[CmdletBinding()]
param(
  [string]$TaskName = "GardenFilemakerAccountAgent",
  [string]$AgentPath = "C:\Garden\filemaker-account-agent\FilemakerAccountAgent.ps1",
  [string]$ConfigPath = "C:\Garden\filemaker-account-agent\config.json"
)
$ErrorActionPreference = "Stop"
$powerShell32 = "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
foreach ($path in @($powerShell32, $AgentPath, $ConfigPath)) {
  if (-not (Test-Path -LiteralPath $path)) { throw "File was not found: $path" }
}
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$AgentPath`" -ConfigPath `"$ConfigPath`""
$action = New-ScheduledTaskAction -Execute $powerShell32 -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5)
$settings = New-ScheduledTaskSettingsSet -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -MultipleInstances IgnoreNew -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "Garden FileMaker account agent (32-bit, every 5 minutes)" -Force
Write-Host "Registered task: $TaskName (SYSTEM, every 5 minutes)"
