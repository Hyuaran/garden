function ConvertTo-ZenkakuValue {
  param([AllowNull()][object]$Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return $null }
  if ($Value -is [datetime]) { return $Value.ToString('yyyy-MM-dd') }
  return [Convert]::ToString($Value, [Globalization.CultureInfo]::InvariantCulture)
}

function Invoke-ZenkakuCycle {
  param(
    [Parameter(Mandatory=$true)][scriptblock]$GetNext,
    [Parameter(Mandatory=$true)][scriptblock]$ReadRecord,
    [Parameter(Mandatory=$true)][scriptblock]$PostResult
  )
  $request = & $GetNext
  if ($null -eq $request) { return $false }
  try {
    $source = & $ReadRecord $request
    if ($null -eq $source) { & $PostResult @{ id=$request.id; outcome='not_found' } | Out-Null }
    else { & $PostResult @{ id=$request.id; outcome='success'; record=$source.record; duplicates=@($source.duplicates) } | Out-Null }
  } catch {
    & $PostResult @{ id=$request.id; outcome='failed'; errorCode='fm_unreachable' } | Out-Null
  }
  return $true
}

function Get-ZenkakuTransport($Config) {
  if (-not $Config.transport) { return 'garden' }
  if ($Config.transport -notin @('garden','supabase')) { throw 'Unknown zenkaku transport.' }
  return [string]$Config.transport
}
function Get-ZenkakuNext($Config, [string]$Secret, [string]$AgentVersion='db-direct-1') {
  if ((Get-ZenkakuTransport $Config) -eq 'garden') {
    $response=Invoke-RestMethod -Method Get -Uri (([string]$Config.apiBaseUrl).TrimEnd('/')+'/api/system/zenkaku-agent/next') -Headers @{Authorization="Bearer $Secret"} -TimeoutSec 30
    return $response.request
  }
  if (-not $env:SUPABASE_URL -or -not $env:SUPABASE_ANON_KEY) { throw 'SUPABASE_URL and SUPABASE_ANON_KEY are required.' }
  $body=@{p_secret=$Secret;p_agent_version=$AgentVersion}|ConvertTo-Json -Compress
  return Invoke-RestMethod -Method Post -Uri ($env:SUPABASE_URL.TrimEnd('/')+'/rest/v1/rpc/system_zenkaku_agent_next') -Headers @{apikey=$env:SUPABASE_ANON_KEY;Authorization="Bearer $env:SUPABASE_ANON_KEY"} -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 30
}
function Get-ZenkakuPollDelay([int]$PollSeconds, [int]$ConsecutiveFailures) {
  $base=[Math]::Max($PollSeconds,3)
  if ($ConsecutiveFailures -le 0) { return $base }
  return [int][Math]::Min(30, $base * [Math]::Pow(2,[Math]::Min($ConsecutiveFailures,10)))
}
