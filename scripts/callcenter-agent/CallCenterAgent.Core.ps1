function Get-EffectiveBatchSize {
  param([int]$ConfiguredBatchSize)
  return [Math]::Min([Math]::Max($ConfiguredBatchSize, 1), 500)
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
