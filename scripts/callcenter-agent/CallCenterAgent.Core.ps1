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
  if (-not $IsExplicitRange) { return $true }
  if ($null -eq $ExistingStateDate) { return $true }
  return $CandidateDate.Date -gt $ExistingStateDate.Date
}
