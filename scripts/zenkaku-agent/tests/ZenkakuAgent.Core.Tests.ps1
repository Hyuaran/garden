$here=Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path (Split-Path -Parent $here) 'ZenkakuAgent.Core.ps1')

Describe 'Invoke-ZenkakuCycle' {
  It 'does nothing when no request exists' {
    $get={ $null };$read={ throw 'must not read' };$post={ param($body)$script:posts+=$body }
    $posts=@();$worked=Invoke-ZenkakuCycle -GetNext $get -ReadRecord $read -PostResult $post
    $worked|Should Be $false
  }
  It 'passes fake source data to the result endpoint' {
    $script:posted=$null
    $get={ @{id='r1';salesId='L1'} };$read={ param($request) @{record=@{salesId=$request.salesId;flag='acquired'};duplicates=@()} };$post={ param($body)$script:posted=$body }
    $worked=Invoke-ZenkakuCycle -GetNext $get -ReadRecord $read -PostResult $post
    $worked|Should Be $true
    $script:posted.outcome|Should Be 'success'
    $script:posted.record.salesId|Should Be 'L1'
  }
  It 'reports read failure and remains available for the next cycle' {
    $script:posted=$null
    $get={ @{id='r2';salesId='L2'} };$read={ throw 'fake ODBC failure' };$post={ param($body)$script:posted=$body }
    $worked=Invoke-ZenkakuCycle -GetNext $get -ReadRecord $read -PostResult $post
    $worked|Should Be $true
    $script:posted.outcome|Should Be 'failed'
    $script:posted.errorCode|Should Be 'fm_unreachable'
  }
}

Describe 'Get-FmSource field map indexing' {
  It 'materializes psobject.Properties as arrays so integer indexing works (2026-08-25 production bug)' {
    # psobject.Properties は整数インデックス不可（$map[0] が null になり、行が見つかったときだけ
    # "Index operation failed" で落ちる）。@() で配列化していることをソースで担保する。
    $source = Get-Content -Raw (Join-Path (Split-Path -Parent $here) 'ZenkakuAgent.ps1')
    $source | Should Match '\$map=@\(\$config\.fieldMap\.psobject\.Properties\)'
    $source | Should Match '\$duplicateMap=@\(\$config\.duplicateFieldMap\.psobject\.Properties\)'
  }
  It 'indexes a materialized property array by integer' {
    $config = '{"fieldMap":{"flag":"P_フラグ","mobileNumber":"携帯番号"}}' | ConvertFrom-Json
    $map = @($config.fieldMap.psobject.Properties)
    $map.Count | Should Be 2
    $map[0].Name | Should Be 'flag'
    $map[1].Value | Should Be '携帯番号'
  }
}

Describe 'ConvertTo-ZenkakuValue' {
  It 'normalizes null and dates without exposing provider objects' {
    (ConvertTo-ZenkakuValue ([DBNull]::Value))|Should Be $null
    (ConvertTo-ZenkakuValue ([datetime]'2026-08-22'))|Should Be '2026-08-22'
  }
}

Describe 'PowerShell 5.1 default paths' {
  It 'resolves script-root paths in the body instead of param defaults' {
    $agent = Get-Content -Raw (Join-Path (Split-Path -Parent $here) 'ZenkakuAgent.ps1')
    $register = Get-Content -Raw (Join-Path (Split-Path -Parent $here) 'Register-ZenkakuAgentTask.ps1')
    $agent | Should Match "\[string\]\`$ConfigPath=''"
    $agent | Should Match 'if\(-not \$ConfigPath\)\{\$ConfigPath=Join-Path \$PSScriptRoot'
    $register | Should Match "\[string\]\`$AgentPath=''"
    $register | Should Match 'if\(-not \$AgentPath\)\{\$AgentPath=Join-Path \$PSScriptRoot'
  }
}
