$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path (Split-Path -Parent $here) "CallCenterAgent.Core.ps1")

Describe "ConvertTo-CallDate" {
  It "parses an exact yyyy-MM-dd call date" {
    ConvertTo-CallDate "2026-01-05" | Should Be ([datetime]"2026-01-05")
  }

  It "returns null for null, empty, or whitespace values" {
    (ConvertTo-CallDate $null) | Should Be $null
    (ConvertTo-CallDate "") | Should Be $null
    (ConvertTo-CallDate "   ") | Should Be $null
  }

  It "returns null without throwing for non-exact formats" {
    (ConvertTo-CallDate "2026/01/05") | Should Be $null
    (ConvertTo-CallDate "2026-01-05T00:00:00") | Should Be $null
    (ConvertTo-CallDate "abc") | Should Be $null
  }

  It "returns null for an impossible calendar date" {
    (ConvertTo-CallDate "2026-02-30") | Should Be $null
  }
}

Describe "Get-CallFetchColumns" {
  $storedFields = @(
    "主キー", "作成日", "作成者", "修正日", "修正者", "社員名", "コール日", "コール時間", "続柄", "結果フラグ", "備考",
    "コールID", "電話番号", "社員ID", "営業ID", "営業回数", "コール終了時間", "新リスト名", "旧リスト名"
  )
  $aggregateFields = @(
    "DATA0", "DATA1", "無効コール件数", "無効件数", "d_結果フラグ", "コール数", "トス", "獲得", "無効", "留守", "担当不在", "見込み", "有効",
    "s_コール数", "s_トス", "s_獲得", "s_無効", "s_留守", "s_担当不在", "s_見込み", "s_有効",
    "コール時間MAX", "コール時間MIN", "現在稼働時間", "一時間毎のコール数"
  )

  It "returns exactly the 19 stored fields by default" {
    $columns = @(Get-CallFetchColumns)
    $columns.Count | Should Be 19
    (Compare-Object $storedFields $columns).Count | Should Be 0
    ($columns -contains "主キー") | Should Be $true
    ($columns -contains "コール日") | Should Be $true
  }

  It "excludes all aggregate fields when explicitly disabled" {
    $columns = @(Get-CallFetchColumns $false)
    foreach ($field in $aggregateFields) { ($columns -contains $field) | Should Be $false }
  }

  It "restores all 25 aggregate fields when enabled" {
    $columns = @(Get-CallFetchColumns $true)
    $columns.Count | Should Be 44
    ($columns | Select-Object -Unique).Count | Should Be 44
    foreach ($field in $aggregateFields) { ($columns -contains $field) | Should Be $true }
  }
}

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

  It "does not rewind date state during normal incremental processing" {
    Test-ShouldAdvanceState ([datetime]"2026-08-12") ([datetime]"2026-08-11") $false $true | Should Be $false
  }

  It "never advances for a partial run" {
    Test-ShouldAdvanceState ([datetime]"2026-08-12") ([datetime]"2026-08-13") $false $false | Should Be $false
  }

  It "never advances without a candidate" {
    Test-ShouldAdvanceState ([datetime]"2026-08-12") $null $true $true | Should Be $false
  }
}

Describe "primary-key incremental helpers" {
  It "normalizes integer-valued DECIMAL keys without numeric narrowing" {
    ConvertTo-NormalizedPrimaryKey "000123.00" | Should Be "123"
    ConvertTo-NormalizedPrimaryKey "999999999999999999999999999999" | Should Be "999999999999999999999999999999"
    (ConvertTo-NormalizedPrimaryKey "12.5") | Should Be $null
  }
  It "compares arbitrarily large normalized keys" {
    (Compare-NormalizedPrimaryKey "100000000000000000000" "99999999999999999999") | Should Be 1
  }
  It "selects bootstrap only until a primary-key state exists" {
    Get-IncrementalQueryMode $false $null | Should Be "bootstrap_date"
    Get-IncrementalQueryMode $false "123" | Should Be "primary_key"
    Get-IncrementalQueryMode $true "123" | Should Be "backfill"
  }
  It "builds a validated numeric primary-key predicate" {
    Get-PrimaryKeyIncrementalPredicate "000123.0" | Should Be 'WHERE "主キー" > 123 ORDER BY "主キー"'
    { Get-PrimaryKeyIncrementalPredicate '1 OR 1=1' } | Should Throw
  }
  It "never advances primary-key state for explicit or partial work" {
    Test-ShouldAdvancePrimaryKey "100" "101" $true $false | Should Be $true
    Test-ShouldAdvancePrimaryKey "100" "101" $false $false | Should Be $false
    Test-ShouldAdvancePrimaryKey "100" "101" $true $true | Should Be $false
  }
  It "advances on the bootstrap run when no primary-key state exists yet" {
    # Regression: a $null existing key is coerced to "" by the [string] param; must be treated as no key.
    Test-ShouldAdvancePrimaryKey $null "3661069" $true $false | Should Be $true
    Test-ShouldAdvancePrimaryKey "" "3661069" $true $false | Should Be $true
    Test-ShouldAdvancePrimaryKey $null $null $true $false | Should Be $false
  }
}

Describe "Test-IsHeartbeatStalled" {
  It "allows fresh progress and detects elapsed timeout" {
    $now = [datetime]"2026-08-12T00:05:01Z"
    Test-IsHeartbeatStalled ([datetime]"2026-08-12T00:00:02Z") $now 300 | Should Be $false
    Test-IsHeartbeatStalled ([datetime]"2026-08-12T00:00:00Z") $now 300 | Should Be $true
  }
}
