[CmdletBinding()]param([string]$TaskName='GardenZenkakuAgent',[string]$AgentPath=(Join-Path $PSScriptRoot 'ZenkakuAgent.ps1'),[string]$ConfigPath=(Join-Path $PSScriptRoot 'config.json'))
$ErrorActionPreference='Stop';$exe="$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
if(-not(Test-Path -LiteralPath $exe)){throw '32-bit PowerShell was not found.'};if(-not(Test-Path -LiteralPath $AgentPath)){throw 'Agent was not found.'};if(-not(Test-Path -LiteralPath $ConfigPath)){throw 'Config was not found.'}
$action=New-ScheduledTaskAction -Execute $exe -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$AgentPath`" -ConfigPath `"$ConfigPath`""
$trigger=New-ScheduledTaskTrigger -AtStartup;$settings=New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$principal=New-ScheduledTaskPrincipal -UserId SYSTEM -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Garden FileMaker zenkaku check bridge (32-bit PowerShell, SYSTEM)' -Force
Write-Host "Registered task: $TaskName (SYSTEM)"
