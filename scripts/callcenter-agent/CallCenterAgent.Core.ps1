function Get-EffectiveBatchSize {
  param([int]$ConfiguredBatchSize)
  return [Math]::Min([Math]::Max($ConfiguredBatchSize, 1), 500)
}

function Get-EffectiveRefreshWindowDays {
  param([AllowNull()] [object]$ConfiguredDays, [int]$DefaultDays = 1, [string]$SettingName = 'refreshWindowDays')
  if ($null -eq $ConfiguredDays -or [string]::IsNullOrWhiteSpace([string]$ConfiguredDays)) { return $DefaultDays }
  $parsed = 0
  if (-not [int]::TryParse([string]$ConfiguredDays, [ref]$parsed) -or $parsed -lt 0) {
    throw "$SettingName must be a non-negative integer."
  }
  return $parsed
}

function Get-CallDateRefreshQuery {
  param(
    [Parameter(Mandatory = $true)] [string]$QuotedColumns,
    [Parameter(Mandatory = $true)] [datetime]$Today,
    [Parameter(Mandatory = $true)] [int]$RefreshWindowDays
  )
  if ($RefreshWindowDays -lt 0) { throw 'refreshWindowDays must be non-negative.' }
  $refreshFrom = $Today.Date.AddDays(-$RefreshWindowDays).ToString('yyyy-MM-dd')
  return "SELECT $QuotedColumns FROM `"コール履歴`" WHERE `"コール日`" >= {d '$refreshFrom'} ORDER BY `"コール日`", `"コール時間`", `"主キー`""
}

function Get-CallFetchColumns {
  param([bool]$IncludeAggregateFields = $false)

  $storedFields = @(
    "主キー", "作成日", "作成者", "修正日", "修正者", "社員名", "コール日", "コール時間", "続柄", "結果フラグ", "備考",
    "コールID", "電話番号", "社員ID", "営業ID", "営業回数", "コール終了時間", "新リスト名", "旧リスト名"
  )
  if (-not $IncludeAggregateFields) { return $storedFields }

  $aggregateFields = @(
    "DATA0", "DATA1", "無効コール件数", "無効件数", "d_結果フラグ", "コール数", "トス", "獲得", "無効", "留守", "担当不在", "見込み", "有効",
    "s_コール数", "s_トス", "s_獲得", "s_無効", "s_留守", "s_担当不在", "s_見込み", "s_有効",
    "コール時間MAX", "コール時間MIN", "現在稼働時間", "一時間毎のコール数"
  )
  return @($storedFields + $aggregateFields)
}

function ConvertTo-CallDate {
  param([AllowNull()] [object]$Value)

  if ($null -eq $Value) { return $null }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }

  $parsed = [datetime]::MinValue
  $success = [datetime]::TryParseExact(
    $text,
    "yyyy-MM-dd",
    [Globalization.CultureInfo]::InvariantCulture,
    [Globalization.DateTimeStyles]::None,
    [ref]$parsed
  )
  if (-not $success) { return $null }
  return $parsed.Date
}

function Get-CallSyncRanges {
  param(
    [Parameter(Mandatory = $true)] [datetime]$From,
    [Parameter(Mandatory = $true)] [datetime]$To,
    [Parameter(Mandatory = $true)] [bool]$SplitByMonth
  )

  $fromDate = $From.Date
  $toDate = $To.Date
  if ($fromDate -gt $toDate) { throw "StartDate must be on or before EndDate." }

  if (-not $SplitByMonth) {
    return ,([pscustomobject]@{ From = $fromDate; To = $toDate; Month = $fromDate.ToString("yyyy-MM") })
  }

  $ranges = @()
  $cursor = $fromDate
  while ($cursor -le $toDate) {
    $monthEnd = $cursor.Date.AddDays(1 - $cursor.Day).AddMonths(1).AddDays(-1)
    if ($monthEnd -gt $toDate) { $monthEnd = $toDate }
    $ranges += [pscustomobject]@{
      From = $cursor
      To = $monthEnd
      Month = $cursor.ToString("yyyy-MM")
    }
    $cursor = $monthEnd.AddDays(1)
  }
  return $ranges
}

function Test-ShouldAdvanceState {
  param(
    [AllowNull()] [Nullable[datetime]]$ExistingStateDate,
    [AllowNull()] [Nullable[datetime]]$CandidateDate,
    [Parameter(Mandatory = $true)] [bool]$IsExplicitRange,
    [Parameter(Mandatory = $true)] [bool]$CompletedWithoutPartial
  )

  if (-not $CompletedWithoutPartial -or $null -eq $CandidateDate) { return $false }
  if ($null -eq $ExistingStateDate) { return $true }
  return $CandidateDate.Date -gt $ExistingStateDate.Date
}

function ConvertTo-NormalizedPrimaryKey {
  param([AllowNull()] [object]$Value)
  if ($null -eq $Value) { return $null }
  $text = [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture).Trim()
  if ($text -notmatch '^\d+(?:\.0+)?$') { return $null }
  $integer = ($text -split '\.')[0].TrimStart('0')
  if ($integer.Length -eq 0) { return '0' }
  return $integer
}

function Compare-NormalizedPrimaryKey {
  param([string]$Left, [string]$Right)
  $a = ConvertTo-NormalizedPrimaryKey $Left; $b = ConvertTo-NormalizedPrimaryKey $Right
  if ($null -eq $a -or $null -eq $b) { throw 'Primary key must be a non-negative integer-valued DECIMAL.' }
  if ($a.Length -ne $b.Length) { return [Math]::Sign($a.Length - $b.Length) }
  return [string]::CompareOrdinal($a, $b)
}

function Test-ShouldAdvancePrimaryKey {
  param([AllowNull()][string]$ExistingPrimaryKey, [AllowNull()][string]$CandidatePrimaryKey, [bool]$CompletedWithoutPartial, [bool]$IsExplicitRange)
  # PowerShell coerces a $null [string] argument to "", so treat empty as "no key" (e.g. the
  # bootstrap run before any last_max_primary_key exists) to avoid comparing against a blank.
  if ($IsExplicitRange -or -not $CompletedWithoutPartial -or [string]::IsNullOrEmpty($CandidatePrimaryKey)) { return $false }
  if ([string]::IsNullOrEmpty($ExistingPrimaryKey)) { return $true }
  return (Compare-NormalizedPrimaryKey $CandidatePrimaryKey $ExistingPrimaryKey) -gt 0
}

function Get-IncrementalQueryMode {
  param([bool]$IsExplicitRange, [AllowNull()][string]$LastPrimaryKey)
  if ($IsExplicitRange) { return 'backfill' }
  if ($LastPrimaryKey) { return 'primary_key' }
  return 'bootstrap_date'
}

function Get-PrimaryKeyIncrementalPredicate {
  param([Parameter(Mandatory = $true)][string]$LastPrimaryKey)
  $normalized = ConvertTo-NormalizedPrimaryKey $LastPrimaryKey
  if ($null -eq $normalized) { throw 'Primary-key state is invalid.' }
  return 'WHERE "主キー" > ' + $normalized + ' ORDER BY "主キー"'
}

function Test-IsHeartbeatStalled {
  param([datetime]$LastWriteUtc, [datetime]$NowUtc, [int]$TimeoutSeconds)
  return ($NowUtc - $LastWriteUtc).TotalSeconds -gt [Math]::Max($TimeoutSeconds, 1)
}

function Get-ShineigyoFetchColumns {
  return @(
    "主キー",
    "電話番号_ハイフンなし",
    "携帯番号_ハイフンなし",
    "リスト名",
    "営業ID",
    "受注日",
    "既契約情報",
    "既契約回線タイプ",
    "既契約継続有無",
    "修正日"
  )
}

function Convert-ShineigyoOdbcValue {
  param(
    [AllowNull()] [object]$Value,
    [Parameter(Mandatory = $true)] [string]$ColumnName
  )

  if ($Value -is [DBNull]) { return $null }
  if ($ColumnName -eq "受注日" -and $Value -is [datetime]) { return $Value.ToString("yyyy-MM-dd") }
  if ($ColumnName -in @("主キー", "営業ID")) { return [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture) }
  return $Value
}

function ConvertTo-ShineigyoApiRow {
  param(
    [Parameter(Mandatory = $true)] [System.Data.IDataRecord]$Reader,
    [Parameter(Mandatory = $true)] [string[]]$Columns
  )

  $row = [ordered]@{}
  for ($i = 0; $i -lt $Columns.Count; $i++) {
    $row[$Columns[$i]] = Convert-ShineigyoOdbcValue $Reader.GetValue($i) $Columns[$i]
  }
  return $row
}

function Get-CallRefreshPlan {
  param([AllowNull()][Nullable[datetime]]$LastFullRefreshUtc, [datetime]$NowUtc,
    [int]$RecentDays, [int]$FullDays, [int]$IntervalMinutes)
  if ($IntervalMinutes -lt 1) { throw 'fullRefreshIntervalMinutes must be a positive integer.' }
  $full = $null -eq $LastFullRefreshUtc -or ($NowUtc.ToUniversalTime() - $LastFullRefreshUtc.ToUniversalTime()).TotalMinutes -ge $IntervalMinutes
  return [pscustomobject]@{
    Kind = $(if ($full) { 'full' } else { 'recent' })
    WindowDays = $(if ($full) { $FullDays } else { $RecentDays })
  }
}
function Compress-IngestBody {
  param([byte[]]$Bytes)
  $output = New-Object System.IO.MemoryStream
  try {
    $gzip = New-Object System.IO.Compression.GZipStream($output, [IO.Compression.CompressionMode]::Compress, $true)
    try { $gzip.Write($Bytes, 0, $Bytes.Length) } finally { $gzip.Dispose() }
    return ,$output.ToArray()
  } finally { $output.Dispose() }
}

function Get-CallRowDigest {
  param([System.Collections.IDictionary]$Row, [string[]]$Columns)
  $values = @($Columns | ForEach-Object { ,$Row[$_] })
  $canonical = ConvertTo-Json -InputObject @($Columns, $values) -Compress -Depth 8
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return [BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($canonical))).Replace('-', '').ToLowerInvariant() }
  finally { $sha.Dispose() }
}

function Read-CallDigestState {
  param([string]$Path)
  $rows = @{}; $lastResend = $null
  if (Test-Path -LiteralPath $Path) {
    $saved = Get-Content -Raw -Encoding UTF8 -LiteralPath $Path | ConvertFrom-Json
    foreach ($property in $saved.rows.PSObject.Properties) { $rows[$property.Name] = $property.Value }
    $lastResend = $saved.last_full_resend_day
  }
  return @{ rows = $rows; last_full_resend_day = $lastResend }
}

function Save-CallDigestState {
  param([string]$Path, [hashtable]$State, [datetime]$Cutoff)
  foreach ($key in @($State.rows.Keys)) {
    $date = ConvertTo-CallDate $State.rows[$key].date
    if ($null -eq $date -or $date -lt $Cutoff.Date) { $State.rows.Remove($key) }
  }
  $temporary = "$Path.$([guid]::NewGuid()).tmp"
  try {
    $State | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $temporary
    if (Test-Path -LiteralPath $Path) { [IO.File]::Replace($temporary, $Path, "$temporary.bak"); Remove-Item -LiteralPath "$temporary.bak" }
    else { [IO.File]::Move($temporary, $Path) }
  } finally { if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary } }
}

function Test-CallFullResendDue {
  param([AllowNull()][string]$LastDay, [datetime]$NowUtc, [int]$Hour = 3)
  if ($Hour -lt 0 -or $Hour -gt 23) { throw 'fullResendHourJst must be between 0 and 23.' }
  $jst = $NowUtc.ToUniversalTime().AddHours(9)
  return $jst.Hour -ge $Hour -and $LastDay -ne $jst.ToString('yyyy-MM-dd')
}

function Test-CallRowUnchanged {
  param([hashtable]$State, [string]$Key, [string]$Digest, [bool]$Force)
  return -not $Force -and $Key -and $State.rows.ContainsKey($Key) -and $State.rows[$Key].digest -eq $Digest
}

function Test-CallForceRefreshEnabled {
  param($Config)
  # Manual requests always use direct Supabase RPC, never Garden/Vercel polling.
  return ($null -eq $Config.transport -or $Config.transport -eq 'supabase') -and
    -not [string]::IsNullOrWhiteSpace($env:SUPABASE_URL) -and
    -not [string]::IsNullOrWhiteSpace($env:SUPABASE_ANON_KEY)
}

function Invoke-CallAgentRpc {
  param([string]$Function, [hashtable]$Body)
  $json = $Body | ConvertTo-Json -Compress
  return Invoke-RestMethod -Method Post -Uri ($env:SUPABASE_URL.TrimEnd('/') + '/rest/v1/rpc/' + $Function) -Headers @{
    apikey = $env:SUPABASE_ANON_KEY; Authorization = "Bearer $env:SUPABASE_ANON_KEY"
  } -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($json)) -TimeoutSec 30
}

function Invoke-CallForceRefreshCycle {
  param($Config, [scriptblock]$Refresh)
  if (-not (Test-CallForceRefreshEnabled $Config)) { return $false }
  $request = Invoke-CallAgentRpc 'system_callcenter_agent_take_request' @{
    p_secret = $env:CALL_INGEST_SECRET; p_agent_version = 'call-force-refresh-1'
  }
  if ($null -eq $request) { return $false }
  $ok = $false; $safeError = $null
  try { & $Refresh | Out-Null; $ok = $true }
  catch { $safeError = 'refresh_failed' }
  $finished = Invoke-CallAgentRpc 'system_callcenter_agent_finish_request' @{
    p_secret = $env:CALL_INGEST_SECRET; p_id = $request.id; p_ok = $ok; p_error = $safeError
  }
  if (-not $finished) { throw 'Force refresh request was no longer running.' }
  return $true
}
