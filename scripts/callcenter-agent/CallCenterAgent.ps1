[CmdletBinding()]
param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot "config.json"),
  [datetime]$StartDate,
  [datetime]$EndDate,
  [ValidateRange(0, 500)] [int]$MaxRows = 0,
  [switch]$DryRun,
  [switch]$Once,
  [switch]$ShowSchema,
  [switch]$CheckPrimaryKeyUniqueness
)

$ErrorActionPreference = "Stop"
$hasExplicitStartDate = $PSBoundParameters.ContainsKey("StartDate")
$hasExplicitEndDate = $PSBoundParameters.ContainsKey("EndDate")
if ([IntPtr]::Size -ne 4) {
  throw "FileMaker ODBC is 32-bit only. Run C:\Windows\SysWOW64\WindowsPowerShell\v1.0\powershell.exe."
}
if (-not (Test-Path -LiteralPath $ConfigPath)) { throw "Config not found: $ConfigPath" }
$config = Get-Content -Raw -Encoding UTF8 -LiteralPath $ConfigPath | ConvertFrom-Json
if (-not $env:FM_CALL_HISTORY_PASSWORD) { throw "FM_CALL_HISTORY_PASSWORD is not configured." }
if (-not $DryRun -and -not $env:CALL_INGEST_SECRET) { throw "CALL_INGEST_SECRET is not configured." }

$batchSize = [Math]::Min([Math]::Max([int]$config.batchSize, 1), 500)
$stateDirectory = [string]$config.stateDirectory
$logDirectory = [string]$config.logDirectory
$statePath = Join-Path $stateDirectory "state.json"
New-Item -ItemType Directory -Force -Path $stateDirectory, $logDirectory | Out-Null

function Write-AgentLog([string]$Level, [string]$Message, [hashtable]$Data = @{}) {
  $safe = [ordered]@{ timestamp = (Get-Date).ToUniversalTime().ToString("o"); level = $Level; message = $Message }
  foreach ($key in $Data.Keys) { $safe[$key] = $Data[$key] }
  $line = $safe | ConvertTo-Json -Compress -Depth 4
  Add-Content -LiteralPath (Join-Path $logDirectory ("agent-{0}.jsonl" -f (Get-Date -Format "yyyyMMdd"))) -Value $line -Encoding UTF8
  Write-Host $line
}

function Get-ConnectionString {
  # FileMaker ODBC treats braces as literal password characters and does not support
  # brace-based connection-string escaping. Passwords must therefore not contain ';'.
  return "Driver={FileMaker ODBC};Server=$($config.fmServer);Port=$($config.fmPort);Database=$($config.fmDatabase);UID=$($config.fmUser);PWD=$($env:FM_CALL_HISTORY_PASSWORD)"
}

function Get-StateDate {
  if (-not (Test-Path -LiteralPath $statePath)) { return $null }
  try {
    $state = Get-Content -Raw -Encoding UTF8 -LiteralPath $statePath | ConvertFrom-Json
    if ($state.last_successful_max_call_date) { return [datetime]::ParseExact([string]$state.last_successful_max_call_date, "yyyy-MM-dd", $null) }
  } catch { throw "State file is invalid. Move it aside after inspection: $statePath" }
  return $null
}

function Save-StateDate([datetime]$Date) {
  $temporary = "$statePath.tmp"
  @{ last_successful_max_call_date = $Date.ToString("yyyy-MM-dd"); updated_at = (Get-Date).ToUniversalTime().ToString("o") } |
    ConvertTo-Json | Set-Content -LiteralPath $temporary -Encoding UTF8
  Move-Item -Force -LiteralPath $temporary -Destination $statePath
}

function Convert-OdbcValue([object]$Value, [string]$ColumnName) {
  if ($Value -is [DBNull]) { return $null }
  if ($ColumnName -eq "コール日" -and $Value -is [datetime]) { return $Value.ToString("yyyy-MM-dd") }
  if ($ColumnName -in @("コール時間", "コール終了時間", "コール時間MAX", "コール時間MIN")) {
    if ($Value -is [TimeSpan]) { return $Value.ToString("hh\:mm\:ss") }
    if ($Value -is [datetime]) { return $Value.ToString("HH:mm:ss") }
  }
  if ($ColumnName -in @("主キー", "営業ID")) { return [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture) }
  return $Value
}

function Invoke-IngestBatch([guid]$RunId, [int]$BatchIndex, [datetime]$From, [datetime]$To, [object[]]$Rows) {
  if ($DryRun) {
    Write-AgentLog "info" "dry-run batch" @{ run_id = $RunId.ToString(); batch_index = $BatchIndex; rows = $Rows.Count }
    return @{ status = "success"; records_rejected = 0 }
  }
  $payload = @{ run_id = $RunId.ToString(); batch_index = $BatchIndex; range_from = $From.ToString("yyyy-MM-dd"); range_to = $To.ToString("yyyy-MM-dd"); rows = [object[]]@($Rows) }
  $body = [Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress -Depth 8))
  $headers = @{ Authorization = "Bearer $env:CALL_INGEST_SECRET" }
  for ($attempt = 1; $attempt -le 4; $attempt++) {
    try {
      return Invoke-RestMethod -Method Post -Uri ([string]$config.apiUrl) -Headers $headers -ContentType "application/json; charset=utf-8" -Body $body -TimeoutSec 300
    } catch {
      if ($attempt -eq 4) { throw "API request failed after 4 attempts (HTTP details omitted from log)." }
      Start-Sleep -Seconds ([Math]::Pow(2, $attempt))
    }
  }
}

$columns = @(
  "主キー", "作成日", "作成者", "修正日", "修正者", "社員名", "コール日", "コール時間", "続柄", "結果フラグ", "備考",
  "コールID", "電話番号", "社員ID", "営業ID", "営業回数", "DATA1", "DATA0", "コール終了時間", "新リスト名",
  "無効コール件数", "無効件数", "d_結果フラグ", "コール数", "トス", "獲得", "無効", "留守", "担当不在", "見込み", "有効",
  "s_コール数", "s_トス", "s_獲得", "s_無効", "s_留守", "s_担当不在", "s_見込み", "s_有効",
  "コール時間MAX", "コール時間MIN", "現在稼働時間", "一時間毎のコール数", "旧リスト名"
)

function Invoke-SyncOnce {
  $runId = [guid]::NewGuid()
  $stateDate = Get-StateDate
  $from = if ($hasExplicitStartDate) { $StartDate.Date } elseif ($stateDate) { $stateDate.AddDays(-[int]$config.overlapDays).Date } else { (Get-Date).Date.AddDays(-1) }
  $to = if ($hasExplicitEndDate) { $EndDate.Date } else { (Get-Date).Date }
  if ($from -gt $to) { throw "StartDate must be on or before EndDate." }
  $connection = New-Object System.Data.Odbc.OdbcConnection (Get-ConnectionString)
  $connection.Open()
  try {
    if ($ShowSchema) {
      $connection.GetSchema("Columns") | Where-Object { $_.TABLE_NAME -eq "コール履歴" } |
        Select-Object COLUMN_NAME, TYPE_NAME, ORDINAL_POSITION | Sort-Object ORDINAL_POSITION | Format-Table -AutoSize
      return
    }
    if ($CheckPrimaryKeyUniqueness) {
      $check = $connection.CreateCommand()
      $check.CommandText = 'SELECT COUNT(*), COUNT(DISTINCT "主キー") FROM "コール履歴"'
      $reader = $check.ExecuteReader()
      if ($reader.Read()) {
        $total = [long]$reader.GetValue(0); $distinct = [long]$reader.GetValue(1)
        Write-AgentLog "info" "primary key uniqueness check" @{ total = $total; distinct_primary_keys = $distinct; match = ($total -eq $distinct) }
        if ($total -ne $distinct) { throw "FM 主キー is not unique." }
      }
      $reader.Close()
      if ($MaxRows -eq 0) { return }
    }

    # Known limitation: this incremental query is based on コール日. Updates older than the
    # overlap window are not observed. Use StartDate/EndDate or increase overlapDays to rescan.
    $quotedColumns = ($columns | ForEach-Object { '"' + $_.Replace('"', '""') + '"' }) -join ","
    $nextDay = $to.AddDays(1).ToString("yyyy-MM-dd")
    $sql = "SELECT $quotedColumns FROM `"コール履歴`" WHERE `"コール日`" >= {d '$($from.ToString("yyyy-MM-dd"))'} AND `"コール日`" < {d '$nextDay'} ORDER BY `"コール日`", `"コール時間`", `"主キー`""
    $command = $connection.CreateCommand(); $command.CommandText = $sql; $command.CommandTimeout = 0
    $reader = $command.ExecuteReader()
    $batch = New-Object System.Collections.ArrayList
    $batchIndex = 0; $totalRows = 0; $hadPartial = $false; $maxCallDate = $null
    while ($reader.Read()) {
      $row = [ordered]@{}
      for ($i = 0; $i -lt $columns.Count; $i++) { $row[$columns[$i]] = Convert-OdbcValue $reader.GetValue($i) $columns[$i] }
      [void]$batch.Add($row); $totalRows++
      $rowDate = [datetime]::ParseExact([string]$row["コール日"], "yyyy-MM-dd", $null)
      if (-not $maxCallDate -or $rowDate -gt $maxCallDate) { $maxCallDate = $rowDate }
      if ($batch.Count -ge $batchSize -or ($MaxRows -gt 0 -and $totalRows -ge $MaxRows)) {
        $result = Invoke-IngestBatch $runId $batchIndex $from $to $batch.ToArray()
        Write-AgentLog "info" "batch completed" @{ run_id = $runId.ToString(); batch_index = $batchIndex; rows = $batch.Count; status = [string]$result.status; rejected = [int]$result.records_rejected }
        if ([string]$result.status -eq "partial") {
          $hadPartial = $true
          $rejectedTargets = @($result.rejected | ForEach-Object { @{ index = [int]$_.index; code = [string]$_.code } })
          Write-AgentLog "warning" "batch partially accepted; rejected rows will not block state advancement" @{ run_id = $runId.ToString(); batch_index = $batchIndex; rejected = [int]$result.records_rejected; targets = $rejectedTargets }
        }
        $batch.Clear(); $batchIndex++
      }
      if ($MaxRows -gt 0 -and $totalRows -ge $MaxRows) { break }
    }
    $reader.Close()
    if ($batch.Count -gt 0) {
      $result = Invoke-IngestBatch $runId $batchIndex $from $to $batch.ToArray()
      Write-AgentLog "info" "batch completed" @{ run_id = $runId.ToString(); batch_index = $batchIndex; rows = $batch.Count; status = [string]$result.status; rejected = [int]$result.records_rejected }
      if ([string]$result.status -eq "partial") {
        $hadPartial = $true
        $rejectedTargets = @($result.rejected | ForEach-Object { @{ index = [int]$_.index; code = [string]$_.code } })
        Write-AgentLog "warning" "batch partially accepted; rejected rows will not block state advancement" @{ run_id = $runId.ToString(); batch_index = $batchIndex; rejected = [int]$result.records_rejected; targets = $rejectedTargets }
      }
    }
    if (-not $DryRun -and $maxCallDate) { Save-StateDate $maxCallDate }
    $syncStatus = if ($hadPartial) { "partial" } else { "success" }
    Write-AgentLog "info" "sync completed" @{ run_id = $runId.ToString(); rows = $totalRows; status = $syncStatus; range_from = $from.ToString("yyyy-MM-dd"); range_to = $to.ToString("yyyy-MM-dd") }
  } finally { $connection.Dispose() }
}

do {
  try { Invoke-SyncOnce }
  catch { Write-AgentLog "error" "sync failed" @{ error_type = $_.Exception.GetType().Name }; if ($Once -or -not [bool]$config.runContinuously) { throw } }
  if ($Once -or -not [bool]$config.runContinuously) { break }
  Start-Sleep -Seconds ([Math]::Max([int]$config.pollSeconds, 60))
} while ($true)
