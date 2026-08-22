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

Describe 'ConvertTo-ZenkakuValue' {
  It 'normalizes null and dates without exposing provider objects' {
    (ConvertTo-ZenkakuValue ([DBNull]::Value))|Should Be $null
    (ConvertTo-ZenkakuValue ([datetime]'2026-08-22'))|Should Be '2026-08-22'
  }
}
