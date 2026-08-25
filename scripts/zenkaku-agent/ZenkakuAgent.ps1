[CmdletBinding()]
param(
  [string]$ConfigPath='', [switch]$Once,
  [switch]$Worker, [string]$RequestId, [string]$SalesId
)
$ErrorActionPreference='Stop'
if(-not $ConfigPath){$ConfigPath=Join-Path $PSScriptRoot 'config.json'}
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'callcenter-agent\CallCenterAgent.Core.ps1')
. (Join-Path $PSScriptRoot 'ZenkakuAgent.Core.ps1')
if ([IntPtr]::Size -ne 4) { throw 'FileMaker ODBC requires 32-bit PowerShell 5.1.' }
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Config not found: $ConfigPath" }
$config=Get-Content -Raw -Encoding UTF8 -LiteralPath $ConfigPath | ConvertFrom-Json
if (-not $env:FM_ZENKAKU_PASSWORD) { throw 'FM_ZENKAKU_PASSWORD is not configured.' }
if (-not $env:ZENKAKU_AGENT_SECRET) { throw 'ZENKAKU_AGENT_SECRET is not configured.' }
New-Item -ItemType Directory -Force -Path ([string]$config.logDirectory) | Out-Null

function Write-ZenkakuLog([string]$level,[string]$message,[hashtable]$data=@{}) {
  $safe=[ordered]@{timestamp=(Get-Date).ToUniversalTime().ToString('o');level=$level;message=$message}
  foreach($key in $data.Keys){$safe[$key]=$data[$key]}
  $line=$safe|ConvertTo-Json -Compress; Add-Content -LiteralPath (Join-Path $config.logDirectory ('agent-{0}.jsonl' -f (Get-Date -Format yyyyMMdd))) -Value $line -Encoding UTF8; Write-Host $line
}
function Invoke-ZenkakuApi([string]$method,[string]$path,[AllowNull()][object]$payload=$null) {
  $args=@{Method=$method;Uri=([string]$config.apiBaseUrl).TrimEnd('/')+$path;Headers=@{Authorization="Bearer $env:ZENKAKU_AGENT_SECRET"};TimeoutSec=30}
  if($null -ne $payload){$args.ContentType='application/json; charset=utf-8';$args.Body=[Text.Encoding]::UTF8.GetBytes(($payload|ConvertTo-Json -Compress -Depth 8))}
  Invoke-RestMethod @args
}
function Get-FmSource([string]$salesId) {
  $map=@($config.fieldMap.psobject.Properties)
  $duplicateMap=@($config.duplicateFieldMap.psobject.Properties)
  $columns=@($map|ForEach-Object{'"'+([string]$_.Value).Replace('"','""')+'"'})+@($duplicateMap|ForEach-Object{'"'+([string]$_.Value).Replace('"','""')+'"'})
  $connectionString="Driver={FileMaker ODBC};Server=$($config.fmServer);Port=$($config.fmPort);Database=$($config.fmDatabase);UID=$($config.fmUser);PWD=$env:FM_ZENKAKU_PASSWORD"
  $connection=New-Object System.Data.Odbc.OdbcConnection $connectionString; $connection.Open()
  try {
    $command=$connection.CreateCommand();$command.CommandTimeout=45
    $table=([string]$config.fmTable).Replace('"','""');$idColumn=([string]$config.salesIdColumn).Replace('"','""')
    $command.CommandText='SELECT '+($columns -join ',')+' FROM "'+$table+'" WHERE "'+$idColumn+'" = ?'
    [void]$command.Parameters.Add('salesId',[System.Data.Odbc.OdbcType]::VarChar,100);$command.Parameters[0].Value=$salesId
    $reader=$command.ExecuteReader();$rows=@()
    while($reader.Read()){$record=[ordered]@{salesId=$salesId};for($i=0;$i -lt $map.Count;$i++){$record[$map[$i].Name]=ConvertTo-ZenkakuValue $reader.GetValue($i)};$meta=[ordered]@{};for($j=0;$j -lt $duplicateMap.Count;$j++){$meta[$duplicateMap[$j].Name]=ConvertTo-ZenkakuValue $reader.GetValue($map.Count+$j)};$rows+=,@{record=$record;meta=$meta}}
    $reader.Close();if($rows.Count -eq 0){return $null}
    $duplicates=@();for($i=1;$i -lt $rows.Count;$i++){$duplicates+=@{caseId=[string]$rows[$i].meta.caseId;productName=[string]$rows[$i].meta.productName;registeredDate=[string]$rows[$i].meta.registeredDate}}
    return @{record=$rows[0].record;duplicates=$duplicates}
  } finally {$connection.Close();$connection.Dispose()}
}
function Post-Failure([string]$id,[string]$code){Invoke-ZenkakuApi 'Post' '/api/system/zenkaku-agent/result' @{id=$id;outcome='failed';errorCode=$code}|Out-Null}

if($Worker){
  try{$source=Get-FmSource $SalesId;if($null -eq $source){$payload=@{id=$RequestId;outcome='not_found'}}else{$payload=@{id=$RequestId;outcome='success';record=$source.record;duplicates=@($source.duplicates)}};Invoke-ZenkakuApi 'Post' '/api/system/zenkaku-agent/result' $payload|Out-Null;exit 0}
  catch{try{Post-Failure $RequestId 'fm_unreachable'}catch{};exit 1}
}

do {
  try {
    $next=Invoke-ZenkakuApi 'Get' '/api/system/zenkaku-agent/next'
    if($null -ne $next.request){
      $started=Get-Date;Write-ZenkakuLog info 'request started' @{request_id=$next.request.id;sales_id=$next.request.salesId}
      $exe="$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
      $arguments=@('-NoProfile','-ExecutionPolicy','Bypass','-File',$PSCommandPath,'-ConfigPath',$ConfigPath,'-Worker','-RequestId',$next.request.id,'-SalesId',$next.request.salesId)
      $process=Start-Process -FilePath $exe -ArgumentList $arguments -PassThru -WindowStyle Hidden
      while(-not $process.HasExited -and -not (Test-IsHeartbeatStalled $started.ToUniversalTime() (Get-Date).ToUniversalTime() 60)){Start-Sleep -Milliseconds 500;$process.Refresh()}
      if(-not $process.HasExited){$process.Kill();Post-Failure $next.request.id 'timeout';Write-ZenkakuLog error 'request timed out' @{request_id=$next.request.id;sales_id=$next.request.salesId}}
      else{Write-ZenkakuLog info 'request completed' @{request_id=$next.request.id;sales_id=$next.request.salesId;exit_code=$process.ExitCode;elapsed_seconds=[Math]::Round(((Get-Date)-$started).TotalSeconds,1)}}
    }
  } catch {Write-ZenkakuLog error 'poll failed' @{error_type=$_.Exception.GetType().Name};if($Once){throw}}
  if($Once){break};Start-Sleep -Seconds ([Math]::Max([int]$config.pollSeconds,3))
} while($true)
