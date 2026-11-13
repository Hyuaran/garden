$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path (Split-Path -Parent $here) 'CallCenterAgent.Core.ps1')

Describe 'changed-only sync with in-memory ODBC and API mocks' {
  $source = Get-Content -Raw -Encoding UTF8 (Join-Path (Split-Path -Parent $here) 'CallCenterAgent.ps1')
  $tokens = $null; $errors = $null
  $ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
  foreach ($name in @('Invoke-SyncOnce', 'Get-AgentState', 'Save-AgentState', 'Convert-OdbcValue')) {
    $definition = $ast.Find({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $false)
    # Replace only the connection construction; execute the production orchestration.
    $text = $definition.Extent.Text.Replace('New-Object System.Data.Odbc.OdbcConnection (Get-ConnectionString)', '$script:fakeConnection')
    . ([scriptblock]::Create($text))
  }
  function Write-AgentLog { param($Level, $Message, $Data) }
  function Update-Heartbeat { param($Phase, [switch]$Force) }
  function Invoke-IngestBatch { param($RunId, $BatchIndex, $From, $To, $Rows) throw 'Unmocked API forbidden' }

  BeforeEach {
    $stateDirectory = Join-Path $TestDrive ([guid]::NewGuid().ToString())
    New-Item -ItemType Directory -Path $stateDirectory | Out-Null
    $statePath = Join-Path $stateDirectory 'state.json'
    $config = [pscustomobject]@{ overlapDays = 1; fullResendHourJst = 3 }
    $batchSize = 500; $refreshWindowDays = 1; $fullRefreshWindowDays = 7; $fullRefreshIntervalMinutes = 60
    $isExplicitRange = $false; $hasExplicitStartDate = $false; $hasExplicitEndDate = $false
    $ShowSchema = $false; $CheckPrimaryKeyUniqueness = $false; $MaxRows = 0; $DryRun = $false
    $columns = @('主キー', 'コール日', '備考')
    Save-AgentState (Get-Date).Date '100' (Get-Date).ToUniversalTime()
    $script:incrementalRows = $false
    $script:table = New-Object Data.DataTable
    foreach ($column in $columns) { [void]$script:table.Columns.Add($column, [string]) }
    [void]$script:table.Rows.Add('1', (Get-Date).ToString('yyyy-MM-dd'), 'initial')
    $script:fakeConnection = [pscustomobject]@{}
    $script:fakeConnection | Add-Member ScriptMethod Open {}
    $script:fakeConnection | Add-Member ScriptMethod Dispose {}
    $script:fakeConnection | Add-Member ScriptMethod CreateCommand {
      $command = [pscustomobject]@{ CommandText = ''; CommandTimeout = 0 }
      $command | Add-Member ScriptMethod ExecuteReader {
        if (-not $script:incrementalRows -and $this.CommandText -match 'WHERE "主キー" >') { return ,$script:table.Clone().CreateDataReader() }
        return ,$script:table.CreateDataReader()
      }
      $command | Add-Member ScriptMethod Dispose {}
      return $command
    }
    Mock Invoke-IngestBatch { return @{ status = 'success'; records_rejected = 0 } }
    Mock Test-CallFullResendDue { return $false }
  }

  It 'sends first read, skips second read, then sends a changed row' {
    Invoke-SyncOnce
    Invoke-SyncOnce
    Assert-MockCalled Invoke-IngestBatch -Scope It -Times 1 -Exactly
    $script:table.Rows[0]['備考'] = 'changed'
    Invoke-SyncOnce
    Assert-MockCalled Invoke-IngestBatch -Scope It -Times 2 -Exactly
  }

  It 'forces unchanged recent rows without sending incremental rows or advancing the daily marker' {
    Invoke-SyncOnce
    $ForceRefresh = $true
    try {
      $script:incrementalRows = $true
      Mock Test-CallFullResendDue { return $true }
      Invoke-SyncOnce
      Assert-MockCalled Invoke-IngestBatch -Scope It -Times 2 -Exactly
      (Read-CallDigestState (Join-Path $stateDirectory 'row-digests.json')).last_full_resend_day | Should BeNullOrEmpty
    } finally { $ForceRefresh = $false }
  }

  It 'fails forced refresh on partial acceptance' {
    $ForceRefresh = $true
    try {
      Mock Invoke-IngestBatch { return @{ status = 'partial'; records_rejected = 1; rejected = @() } }
      { Invoke-SyncOnce } | Should Throw
      (Test-Path (Join-Path $stateDirectory 'row-digests.json')) | Should Be $false
    } finally { $ForceRefresh = $false }
  }

  It 'always sends primary-key incremental rows even when their digest matches' {
    Invoke-SyncOnce
    $script:incrementalRows = $true
    Invoke-SyncOnce
    Assert-MockCalled Invoke-IngestBatch -Scope It -Times 2 -Exactly
  }

  It 'keeps digest file unchanged on transport failure and retries next run' {
    Invoke-SyncOnce
    $path = Join-Path $stateDirectory 'row-digests.json'
    $before = Get-Content -Raw $path
    $script:table.Rows[0]['備考'] = 'changed'
    Mock Invoke-IngestBatch { throw 'mock transport failure' }
    { Invoke-SyncOnce } | Should Throw
    (Get-Content -Raw $path) | Should Be $before
    Mock Invoke-IngestBatch { return @{ status = 'success'; records_rejected = 0 } }
    Invoke-SyncOnce
    (Get-Content -Raw $path) | Should Not Be $before
  }

  It 'does not persist partial, DryRun, MaxRows or explicit backfill digests' {
    Mock Invoke-IngestBatch { return @{ status = 'partial'; records_rejected = 1; rejected = @() } }
    Invoke-SyncOnce
    (Test-Path (Join-Path $stateDirectory 'row-digests.json')) | Should Be $false
    Mock Invoke-IngestBatch { return @{ status = 'success'; records_rejected = 0 } }
    $DryRun = $true; Invoke-SyncOnce; $DryRun = $false
    (Test-Path (Join-Path $stateDirectory 'row-digests.json')) | Should Be $false
    $MaxRows = 1; Invoke-SyncOnce; $MaxRows = 0
    (Test-Path (Join-Path $stateDirectory 'row-digests.json')) | Should Be $false
    $isExplicitRange = $true; Invoke-SyncOnce
    (Test-Path (Join-Path $stateDirectory 'row-digests.json')) | Should Be $false
  }

  It 'sends unchanged full window when daily repair is due and records its day' {
    Invoke-SyncOnce
    Mock Test-CallFullResendDue { return $true }
    Invoke-SyncOnce
    Assert-MockCalled Invoke-IngestBatch -Scope It -Times 2 -Exactly
    (Read-CallDigestState (Join-Path $stateDirectory 'row-digests.json')).last_full_resend_day | Should Be ((Get-Date).ToUniversalTime().AddHours(9).ToString('yyyy-MM-dd'))
  }
}
