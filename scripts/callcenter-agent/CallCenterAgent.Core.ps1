function Get-EffectiveBatchSize {
  param([int]$ConfiguredBatchSize)
  return [Math]::Min([Math]::Max($ConfiguredBatchSize, 1), 500)
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
  if ($IsExplicitRange -or -not $CompletedWithoutPartial -or $null -eq $CandidatePrimaryKey) { return $false }
  if ($null -eq $ExistingPrimaryKey) { return $true }
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
