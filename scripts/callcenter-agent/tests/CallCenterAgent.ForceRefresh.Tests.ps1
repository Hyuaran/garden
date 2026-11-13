$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path (Split-Path -Parent $here) 'CallCenterAgent.Core.ps1')
Describe 'manual refresh RPC with mocked transport' {
  BeforeEach {
    $savedUrl = $env:SUPABASE_URL; $savedKey = $env:SUPABASE_ANON_KEY; $savedSecret = $env:CALL_INGEST_SECRET
    $env:SUPABASE_URL = 'https://mock.invalid'; $env:SUPABASE_ANON_KEY = 'test-anon'; $env:CALL_INGEST_SECRET = 'test-secret'
    $config = [pscustomobject]@{ transport = 'supabase' }
    $script:refreshed = 0; $script:bodies = @(); $script:hasRequest = $true
    Mock Invoke-RestMethod {
      $script:bodies += ([Text.Encoding]::UTF8.GetString($Body) | ConvertFrom-Json)
      if ($Uri -like '*take_request') { if ($script:hasRequest) { return @{ id = 'request-1' } }; return $null }
      return $true
    }
  }
  AfterEach { $env:SUPABASE_URL = $savedUrl; $env:SUPABASE_ANON_KEY = $savedKey; $env:CALL_INGEST_SECRET = $savedSecret }
  It 'refreshes then finishes successfully over direct Supabase RPC' {
    Invoke-CallForceRefreshCycle $config { $script:refreshed++ } | Should Be $true
    $script:refreshed | Should Be 1
    $script:bodies[0].p_secret | Should Be 'test-secret'
    $script:bodies[1].p_ok | Should Be $true
    $script:bodies[1].p_id | Should Be 'request-1'
    Assert-MockCalled Invoke-RestMethod -Scope It -Times 2 -Exactly -ParameterFilter { $Uri -like 'https://mock.invalid/rest/v1/rpc/*' -and $Headers.apikey -eq 'test-anon' }
  }
  It 'does nothing when no request exists' {
    $script:hasRequest = $false
    Invoke-CallForceRefreshCycle $config { throw 'must not refresh' } | Should Be $false
    Assert-MockCalled Invoke-RestMethod -Scope It -Times 1 -Exactly
  }
  It 'disables only the optional feature when Supabase is missing' {
    $env:SUPABASE_URL = ''
    Invoke-CallForceRefreshCycle $config { throw 'must not refresh' } | Should Be $false
    Assert-MockCalled Invoke-RestMethod -Scope It -Times 0 -Exactly
  }
  It 'reports failure without leaking exception details' {
    Invoke-CallForceRefreshCycle $config { throw 'private detail' } | Should Be $true
    $script:bodies[1].p_ok | Should Be $false
    $script:bodies[1].p_error | Should Be 'refresh_failed'
  }
}
