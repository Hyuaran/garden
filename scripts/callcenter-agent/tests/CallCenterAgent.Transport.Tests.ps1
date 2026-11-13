$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path (Split-Path -Parent $here) 'CallCenterAgent.Core.ps1')
Describe 'agent HTTP request compression with mocked transport' {
  foreach ($file in @('CallCenterAgent.ps1', 'ShineigyoSnapshot.ps1')) {
    $source = Get-Content -Raw -Encoding UTF8 (Join-Path (Split-Path -Parent $here) $file)
    $tokens = $null; $errors = $null
    $ast = [Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
    $name = if ($file -eq 'CallCenterAgent.ps1') { 'Invoke-IngestBatch' } else { 'Invoke-ShineigyoBatch' }
    $definition = $ast.Find({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name }, $false)
    . ([scriptblock]::Create($definition.Extent.Text))
  }
  function Update-Heartbeat { param($Phase, [switch]$Force) }
  function Update-ShineigyoHeartbeat { param($Phase, [switch]$Force) }
  function Write-AgentLog { param($Level, $Message, $Data) }
  BeforeEach {
    $DryRun = $false
    $config = [pscustomobject]@{ apiUrl = 'http://mock.invalid/'; shineigyoApiUrl = 'http://mock.invalid/' }
    $script:captured = $null
    Mock Invoke-RestMethod {
      $script:captured = @{ body = $Body; headers = $Headers; contentType = $ContentType }
      return @{ status = 'success'; records_rejected = 0 }
    }
  }
  It 'sends gzip bytes by default for both batch endpoints' {
    $rows = @(@{ note = '日本語' })
    foreach ($endpoint in @('call', 'snapshot')) {
      if ($endpoint -eq 'call') { Invoke-IngestBatch ([guid]::NewGuid()) 0 (Get-Date) (Get-Date) $rows | Out-Null }
      else { Invoke-ShineigyoBatch ([guid]::NewGuid()) 0 $rows | Out-Null }
      $script:captured.headers['Content-Encoding'] | Should Be 'gzip'
      $script:captured.contentType | Should Match '^application/json'
      ($script:captured.body -is [byte[]]) | Should Be $true
      $inputStream = New-Object IO.MemoryStream(,$script:captured.body)
      $gzip = New-Object IO.Compression.GZipStream($inputStream, [IO.Compression.CompressionMode]::Decompress)
      $reader = New-Object IO.StreamReader($gzip, [Text.Encoding]::UTF8)
      try { ($reader.ReadToEnd() | ConvertFrom-Json).rows[0].note | Should Be '日本語' }
      finally { $reader.Dispose(); $inputStream.Dispose() }
    }
    Assert-MockCalled Invoke-RestMethod -Scope It -Times 2 -Exactly
  }
  It 'allows disabling gzip for both batch endpoints' {
    $config | Add-Member NoteProperty gzipRequestBody $false
    foreach ($endpoint in @('call', 'snapshot')) {
      if ($endpoint -eq 'call') { Invoke-IngestBatch ([guid]::NewGuid()) 0 (Get-Date) (Get-Date) @(@{ id = '1' }) | Out-Null }
      else { Invoke-ShineigyoBatch ([guid]::NewGuid()) 0 @(@{ id = '1' }) | Out-Null }
      $script:captured.headers.ContainsKey('Content-Encoding') | Should Be $false
      ([Text.Encoding]::UTF8.GetString($script:captured.body) | ConvertFrom-Json).rows[0].id | Should Be '1'
    }
  }
  It 'does not call HTTP for call DryRun' {
    $DryRun = $true
    Invoke-IngestBatch ([guid]::NewGuid()) 0 (Get-Date) (Get-Date) @(@{ id = '1' }) | Out-Null
    Assert-MockCalled Invoke-RestMethod -Scope It -Times 0 -Exactly
  }
}
