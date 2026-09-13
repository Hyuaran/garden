[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json"),
  [switch]$DryRun,
  [switch]$Once,
  [switch]$Worker,
  [string]$HeartbeatPath
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "CallCenterAgent.Core.ps1")

if ([IntPtr]::Size -ne 4) {
  throw "FileMaker ODBC is 32-bit only. Run C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe."
}
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Config not found: $ConfigPath" }
$config = Get-Content -Raw -Encoding UTF8 -LiteralPath $ConfigPath | ConvertFrom-Json
if (-not $env:FM_CALL_HISTORY_PASSWORD) { throw "FM_CALL_HISTORY_PASSWORD is not configured." }
if (-not $DryRun -and -not $env:CALL_INGEST_SECRET) { throw "CALL_INGEST_SECRET is not configured." }
if (-not $DryRun -and [string]::IsNullOrWhiteSpace([string]$config.shineigyoApiUrl)) { throw "shineigyoApiUrl is not configured." }

$batchSize = Get-EffectiveBatchSize ([int]$config.batchSize)
$stateDirectory = [string]$config.stateDirectory
$logDirectory = [string]$config.logDirectory
New-Item -ItemType Directory -Force -Path $stateDirectory, $logDirectory | Out-Null

function Write-ShineigyoLog([string]$Level, [string]$Message, [hashtable]$Data = @{}) {
  $safe = [ordered]@{ timestamp = (Get-Date).ToUniversalTime().ToString("o"); level = $Level; message = $Message }
  foreach ($key in $Data.Keys) { $safe[$key] = $Data[$key] }
  $line = $safe | ConvertTo-Json -Compress -Depth 5
  Add-Content -LiteralPath (Join-Path $logDirectory ("shineigyo-snapshot-{0}.jsonl" -f (Get-Date -Format "yyyyMMdd"))) -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-ShineigyoConnectionString {
  return "Driver={FileMaker ODBC};Server=$($config.fmServer);Port=$($config.fmPort);Database=$($config.fmDatabase);UID=$($config.fmUser);PWD=$($env:FM_CALL_HISTORY_PASSWORD)"
}

$heartbeatIntervalSeconds = if ($config.heartbeatIntervalSeconds) { [Math]::Max([int]$config.heartbeatIntervalSeconds, 1) } else { 5 }
$script:lastHeartbeatUtc = [datetime]::MinValue
function Update-ShineigyoHeartbeat([string]$Phase, [switch]$Force) {
  if (-not $Worker -or -not $HeartbeatPath) { return }
  $now = (Get-Date).ToUniversalTime()
  if (-not $Force -and ($now - $script:lastHeartbeatUtc).TotalSeconds -lt $heartbeatIntervalSeconds) { return }
  @{ updated_at = $now.ToString("o"); phase = $Phase } | ConvertTo-Json -Compress | Set-Content -LiteralPath $HeartbeatPath -Encoding UTF8
  $script:lastHeartbeatUtc = $now
}

function Invoke-ShineigyoBatch([guid]$RunId, [int]$BatchIndex, [object[]]$Rows) {
  Update-ShineigyoHeartbeat "batch" -Force
  $payload = @{ runId = $RunId.ToString(); batchIndex = $BatchIndex; rows = [object[]]@($Rows) }
  $body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress -Depth 8))
  $headers = @{ Authorization = "Bearer $env:CALL_INGEST_SECRET" }
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      return Invoke-RestMethod -Method Post -Uri ([string]$config.shineigyoApiUrl) -Headers $headers -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec 300
    } catch {
      if ($attempt -eq 4) { throw "API request failed after 4 attempts (HTTP details omitted from log)." }
      Start-Sleep -Seconds ([Math]::Pow(2, $attempt))
    }
  }
}

function Complete-ShineigyoRun([guid]$RunId, [int]$Total) {
  $payload = @{ runId = $RunId.ToString(); total = $Total }
  $body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress -Depth 4))
  $headers = @{ Authorization = "Bearer $env:CALL_INGEST_SECRET" }
  $uri = ([string]$config.shineigyoApiUrl).TrimEnd("/") + "/complete"
  return Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec 300
}

$columns = @(Get-ShineigyoFetchColumns)

function Invoke-ShineigyoOnce {
  $runId = [guid]::NewGuid()
  $startedAt = Get-Date
  $quotedColumns = ($columns | ForEach-Object { '"' + $_.Replace('"', '""') + '"' }) -join ","
  $sql = "SELECT $quotedColumns FROM `"新営業`" ORDER BY `"主キー`""
  $connection = New-Object System.Data.Odbc.OdbcConnection (Get-ShineigyoConnectionString)
  Write-ShineigyoLog "info" "snapshot started" @{ run_id = $runId.ToString(); dry_run = [bool]$DryRun }
  $connection.Open()
  try {
    $command = $connection.CreateCommand()
    $command.CommandText = $sql
    $command.CommandTimeout = 0
    $reader = $null
    try {
      Update-ShineigyoHeartbeat "reading" -Force
      $reader = $command.ExecuteReader()
      $batch = New-Object System.Collections.ArrayList
      $sampleTypes = @()
      $batchIndex = 0
      $totalRows = 0
      while ($reader.Read()) {
        Update-ShineigyoHeartbeat "reading"
        if ($DryRun -and $sampleTypes.Count -lt 3) {
          $sampleTypes += [pscustomobject]@{
            row = $sampleTypes.Count + 1
            columns = @($columns | ForEach-Object {
              $ordinal = [Array]::IndexOf($columns, $_)
              @{ name = $_; type = $reader.GetFieldType($ordinal).Name }
            })
          }
        }
        $row = ConvertTo-ShineigyoApiRow $reader $columns
        $totalRows++
        if (-not $DryRun) {
          [void]$batch.Add($row)
          if ($batch.Count -ge $batchSize) {
            $rowsInBatch = $batch.Count
            $result = Invoke-ShineigyoBatch $runId $batchIndex $batch.ToArray()
            Write-ShineigyoLog "info" "batch completed" @{ run_id = $runId.ToString(); batch_index = $batchIndex; rows = $rowsInBatch; cumulative_rows = $totalRows; status = [string]$result.status }
            $batch.Clear()
            $batchIndex++
            Update-ShineigyoHeartbeat "reading" -Force
          }
        }
      }
      if (-not $DryRun -and $batch.Count -gt 0) {
        $rowsInBatch = $batch.Count
        $result = Invoke-ShineigyoBatch $runId $batchIndex $batch.ToArray()
        Write-ShineigyoLog "info" "batch completed" @{ run_id = $runId.ToString(); batch_index = $batchIndex; rows = $rowsInBatch; cumulative_rows = $totalRows; status = [string]$result.status }
        $batchIndex++
      }
      if ($DryRun) {
        Write-ShineigyoLog "info" "dry-run completed" @{ run_id = $runId.ToString(); rows = $totalRows; samples = $sampleTypes; elapsed_seconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1) }
      } else {
        $complete = Complete-ShineigyoRun $runId $totalRows
        Write-ShineigyoLog "info" "snapshot completed" @{ run_id = $runId.ToString(); rows = $totalRows; complete_status = [string]$complete.status; elapsed_seconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1) }
      }
    } catch {
      Write-ShineigyoLog "error" "snapshot failed" @{ run_id = $runId.ToString(); status = "failed"; elapsed_seconds = [Math]::Round(((Get-Date) - $startedAt).TotalSeconds, 1); error_type = $_.Exception.GetType().Name }
      throw
    } finally {
      if ($reader) { $reader.Close() }
      if ($command) { $command.Dispose() }
    }
  } finally {
    $connection.Dispose()
  }
}

function Invoke-ShineigyoWorkerProcess {
  $heartbeat = Join-Path $stateDirectory ("shineigyo-heartbeat-{0}.json" -f [guid]::NewGuid())
  @{ updated_at = (Get-Date).ToUniversalTime().ToString("o"); phase = "starting" } | ConvertTo-Json -Compress | Set-Content -LiteralPath $heartbeat -Encoding UTF8
  $exe = "C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe"
  $args = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ('"{0}"' -f $PSCommandPath), "-ConfigPath", ('"{0}"' -f $ConfigPath), "-Worker", "-Once", "-HeartbeatPath", ('"{0}"' -f $heartbeat))
  if ($DryRun) { $args += "-DryRun" }
  $process = Start-Process -FilePath $exe -ArgumentList $args -PassThru -WindowStyle Hidden
  $timeout = if ($config.readStallTimeoutSeconds) { [Math]::Max([int]$config.readStallTimeoutSeconds, 1) } else { 300 }
  try {
    while (-not $process.HasExited) {
      Start-Sleep -Seconds 1
      $process.Refresh()
      $lastWrite = (Get-Item -LiteralPath $heartbeat).LastWriteTimeUtc
      if (Test-IsHeartbeatStalled $lastWrite (Get-Date).ToUniversalTime() $timeout) {
        Stop-Process -Id $process.Id -Force
        throw "Worker made no progress within the configured read stall timeout."
      }
    }
    if ($process.ExitCode -ne 0) { throw "Worker exited with code $($process.ExitCode)." }
  } finally {
    Remove-Item -LiteralPath $heartbeat -Force -ErrorAction SilentlyContinue
  }
}

if ($Worker) {
  Update-ShineigyoHeartbeat "starting" -Force
  Invoke-ShineigyoOnce
  Update-ShineigyoHeartbeat "completed" -Force
  return
}

do {
  try { Invoke-ShineigyoWorkerProcess }
  catch {
    Write-ShineigyoLog "error" "snapshot failed" @{ error_type = $_.Exception.GetType().Name }
    if ($Once -or -not [bool]$config.runContinuously) { throw }
  }
  if ($Once -or -not [bool]$config.runContinuously) { break }
  Start-Sleep -Seconds ([Math]::Max([int]$config.pollSeconds, 60))
} while ($true)
