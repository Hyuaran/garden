$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path (Split-Path -Parent $here) "CallCenterAgent.Core.ps1")

Describe "Get-EffectiveBatchSize" {
  It "keeps the server contract capped at 500 rows" {
    Get-EffectiveBatchSize 1000 | Should Be 500
    Get-EffectiveBatchSize 500 | Should Be 500
  }

  It "keeps configured sizes within the supported range" {
    Get-EffectiveBatchSize 250 | Should Be 250
    Get-EffectiveBatchSize 0 | Should Be 1
  }
}

Describe "Get-CallSyncRanges" {
  It "keeps an incremental run as one range" {
    $ranges = @(Get-CallSyncRanges ([datetime]"2026-05-13") ([datetime]"2026-08-12") $false)
    $ranges.Count | Should Be 1
    $ranges[0].From | Should Be ([datetime]"2026-05-13")
    $ranges[0].To | Should Be ([datetime]"2026-08-12")
  }

  It "keeps a same-month backfill as one clipped range" {
    $ranges = @(Get-CallSyncRanges ([datetime]"2026-05-13") ([datetime]"2026-05-20") $true)
    $ranges.Count | Should Be 1
    $ranges[0].From | Should Be ([datetime]"2026-05-13")
    $ranges[0].To | Should Be ([datetime]"2026-05-20")
  }

  It "splits a multi-month backfill at month boundaries" {
    $ranges = @(Get-CallSyncRanges ([datetime]"2026-05-13") ([datetime]"2026-08-12") $true)
    $ranges.Count | Should Be 4
    $ranges[0].From | Should Be ([datetime]"2026-05-13")
    $ranges[0].To | Should Be ([datetime]"2026-05-31")
    $ranges[1].From | Should Be ([datetime]"2026-06-01")
    $ranges[2].To | Should Be ([datetime]"2026-07-31")
    $ranges[3].From | Should Be ([datetime]"2026-08-01")
    $ranges[3].To | Should Be ([datetime]"2026-08-12")
  }

  It "splits correctly across a year boundary" {
    $ranges = @(Get-CallSyncRanges ([datetime]"2025-12-15") ([datetime]"2026-01-10") $true)
    $ranges.Count | Should Be 2
    $ranges[0].To | Should Be ([datetime]"2025-12-31")
    $ranges[1].From | Should Be ([datetime]"2026-01-01")
  }

  It "handles a range starting on a long month end" {
    $ranges = @(Get-CallSyncRanges ([datetime]"2026-01-31") ([datetime]"2026-03-01") $true)
    $ranges.Count | Should Be 3
    $ranges[0].From | Should Be ([datetime]"2026-01-31")
    $ranges[0].To | Should Be ([datetime]"2026-01-31")
    $ranges[1].From | Should Be ([datetime]"2026-02-01")
    $ranges[1].To | Should Be ([datetime]"2026-02-28")
    $ranges[2].From | Should Be ([datetime]"2026-03-01")
  }

  It "rejects an inverted range" {
    { Get-CallSyncRanges ([datetime]"2026-08-12") ([datetime]"2026-05-13") $true } | Should Throw
  }
}

Describe "Test-ShouldAdvanceState" {
  It "saves the first successful candidate" {
    Test-ShouldAdvanceState $null ([datetime]"2026-05-31") $true $true | Should Be $true
  }

  It "advances an explicit backfill only when the candidate is newer" {
    Test-ShouldAdvanceState ([datetime]"2026-05-31") ([datetime]"2026-06-01") $true $true | Should Be $true
  }

  It "does not rewind state for an older explicit backfill" {
    Test-ShouldAdvanceState ([datetime]"2026-08-12") ([datetime]"2025-12-31") $true $true | Should Be $false
  }

  It "does not rewrite state for the same explicit date" {
    Test-ShouldAdvanceState ([datetime]"2026-08-12") ([datetime]"2026-08-12") $true $true | Should Be $false
  }

  It "preserves normal incremental state behavior" {
    Test-ShouldAdvanceState ([datetime]"2026-08-12") ([datetime]"2026-08-11") $false $true | Should Be $true
  }

  It "never advances for a partial run" {
    Test-ShouldAdvanceState ([datetime]"2026-08-12") ([datetime]"2026-08-13") $false $false | Should Be $false
  }

  It "never advances without a candidate" {
    Test-ShouldAdvanceState ([datetime]"2026-08-12") $null $true $true | Should Be $false
  }
}
