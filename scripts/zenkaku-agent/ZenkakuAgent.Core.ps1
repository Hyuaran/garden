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
