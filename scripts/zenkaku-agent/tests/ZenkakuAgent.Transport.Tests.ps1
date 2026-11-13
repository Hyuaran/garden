$here=Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path (Split-Path -Parent $here) 'ZenkakuAgent.Core.ps1')
Describe 'Transport and backoff' {
  BeforeEach {
    $script:oldUrl=$env:SUPABASE_URL;$script:oldKey=$env:SUPABASE_ANON_KEY
    $env:SUPABASE_URL='https://supabase.invalid';$env:SUPABASE_ANON_KEY='fake-anon'
    Mock Invoke-RestMethod { @{id='s1';operation='submit'} }
  }
  AfterEach { $env:SUPABASE_URL=$script:oldUrl;$env:SUPABASE_ANON_KEY=$script:oldKey }
  It 'defaults to Garden and unwraps requests' {
    Mock Invoke-RestMethod { @{request=@{id='g1'}} }
    (Get-ZenkakuNext ([pscustomobject]@{apiBaseUrl='https://garden.invalid'}) 'fake').id | Should Be 'g1'
    Assert-MockCalled Invoke-RestMethod -Times 1 -Exactly -ParameterFilter { $Method -eq 'Get' -and $Uri -eq 'https://garden.invalid/api/system/zenkaku-agent/next' }
  }
  It 'uses the direct RPC and secret JSON' {
    (Get-ZenkakuNext ([pscustomobject]@{transport='supabase'}) 'fake-secret').operation | Should Be 'submit'
    Assert-MockCalled Invoke-RestMethod -Times 1 -Exactly -ParameterFilter { $Method -eq 'Post' -and $Uri -eq 'https://supabase.invalid/rest/v1/rpc/system_zenkaku_agent_next' -and $Headers.apikey -eq 'fake-anon' -and (([Text.Encoding]::UTF8.GetString($Body)|ConvertFrom-Json).p_secret -eq 'fake-secret') }
  }
  It 'returns null for no work' {
    Mock Invoke-RestMethod { $null }
    Get-ZenkakuNext ([pscustomobject]@{transport='supabase'}) 'fake' | Should Be $null
  }
  It 'propagates failures without fallback' {
    Mock Invoke-RestMethod { throw 'offline' }
    { Get-ZenkakuNext ([pscustomobject]@{transport='supabase'}) 'fake' } | Should Throw
    Assert-MockCalled Invoke-RestMethod -Times 1 -Exactly -Scope It
  }
  It 'extends the delay and resets on success' {
    (Get-ZenkakuPollDelay 3 0)|Should Be 3
    (Get-ZenkakuPollDelay 3 1)|Should Be 6
    (Get-ZenkakuPollDelay 3 2)|Should Be 12
    (Get-ZenkakuPollDelay 3 3)|Should Be 24
    (Get-ZenkakuPollDelay 3 4)|Should Be 30
    (Get-ZenkakuPollDelay 3 10)|Should Be 30
    (Get-ZenkakuPollDelay 3 0)|Should Be 3
  }
}
