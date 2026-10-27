[CmdletBinding()]
param([string]$ConfigPath = "")
$ErrorActionPreference = "Stop"
# The host PC's 32-bit PowerShell leaves $PSScriptRoot empty in the param block (2026-10-27).
$scriptPath = $MyInvocation.MyCommand.Path
if (-not $scriptPath) { $scriptPath = "C:\Garden\filemaker-account-agent\FilemakerAccountAgent.ps1" }
if (-not $ConfigPath) { $ConfigPath = Join-Path (Split-Path -Parent $scriptPath) "config.json" }
if ([Environment]::Is64BitProcess) {
  & "$env:WINDIR\SysWOW64\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File $scriptPath -ConfigPath $ConfigPath
  exit $LASTEXITCODE
}
# Prevent simultaneous scheduled/manual executions on this host.
$mutex = New-Object Threading.Mutex($false, "Global\GardenFilemakerAccountAgent")
$locked = $false
$exitCode = 0
$logDir = "C:\ProgramData\Garden\FilemakerAccountAgent\logs"
New-Item -ItemType Directory -Path $logDir -Force | Out-Null
function Write-AgentLog([string]$Message) {
  Add-Content -LiteralPath (Join-Path $logDir ((Get-Date -Format "yyyy-MM-dd") + ".log")) -Value ((Get-Date -Format "s") + " " + $Message) -Encoding UTF8
}
function Invoke-FmQuery($Connection, [string]$Sql, [object[]]$Values, [switch]$Scalar) {
  $command = $Connection.CreateCommand()
  try {
    $command.CommandText = $Sql
    $command.CommandTimeout = 30
    foreach ($value in $Values) {
      $parameter = New-Object System.Data.Odbc.OdbcParameter
      if ($value -is [datetime]) {
        $parameter.OdbcType = [System.Data.Odbc.OdbcType]::Date
        $parameter.Value = $value
      } elseif ($value -is [long] -or $value -is [int]) {
        $parameter.OdbcType = [System.Data.Odbc.OdbcType]::Int
        $parameter.Value = [int]$value
      } else {
        # VarChar sends Japanese as single-byte and FileMaker stores mojibake (2026-10-27).
        $parameter.OdbcType = [System.Data.Odbc.OdbcType]::NVarChar
        $parameter.Value = [string]$value
      }
      [void]$command.Parameters.Add($parameter)
    }
    if ($Scalar) { return $command.ExecuteScalar() }
    [void]$command.ExecuteNonQuery()
  } finally { $command.Dispose() }
}
try {
  try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
  if (-not $locked) { exit 0 }
  foreach ($name in @("RELAY_SECRET", "FM_CALL_HISTORY_PASSWORD")) {
    $value = [Environment]::GetEnvironmentVariable($name, "Machine")
    if (-not $value) { $value = [Environment]::GetEnvironmentVariable($name, "Process") }
    if (-not $value) { throw "Missing environment variable" }
    [Environment]::SetEnvironmentVariable($name, $value, "Process")
  }
  $config = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
  # FileMaker's driver does not support brace escaping for passwords.
  if ($env:FM_CALL_HISTORY_PASSWORD.Contains(';')) { throw "Unsupported ODBC password format" }
  $endpoint = $config.apiBase.TrimEnd('/') + "/api/system/filemaker-accounts/agent"
  $headers = @{Authorization = "Bearer " + $env:RELAY_SECRET}
  $work = Invoke-RestMethod -Uri $endpoint -Headers $headers -Method Get -TimeoutSec 60
  $results = New-Object 'System.Collections.Generic.List[object]'
  foreach ($kind in @("jobs", "checks")) {
    foreach ($job in $work.$kind) {
      foreach ($file in $job.files) {
        $connection = $null
        try {
          if ($file -notin @("eigyo", "shain", "call", "roster")) { throw "Unknown file" }
          $database = $config.files.$file
          if (-not $database -or $database.Contains(';')) { throw "Invalid database" }
          $requestId = $job.id + "-" + $file
          $connection = New-Object System.Data.Odbc.OdbcConnection ("Driver={FileMaker ODBC};Server=" + $config.fmServer + ";Port=" + $config.fmPort + ";Database=" + $database + ";UID=" + $config.fmUser + ";PWD=" + $env:FM_CALL_HISTORY_PASSWORD)
          $connection.Open()
          if ($file -eq "roster") {
            $r = $job.roster
            $employeeId = Invoke-FmQuery $connection 'SELECT "社員ID" FROM "社員情報" WHERE "打刻ID" = ?' @($r.employeeNumber) -Scalar
            if ($null -eq $employeeId -or $employeeId -is [DBNull]) {
              # ExecuteScalar uses the first row without MAX or FETCH FIRST.
              $maximum = Invoke-FmQuery $connection 'SELECT "社員ID" FROM "社員情報" ORDER BY "社員ID" DESC' @() -Scalar
              $employeeId = 1
              if ($null -ne $maximum -and $maximum -isnot [DBNull]) { $employeeId = [long]$maximum + 1 }
              $hireDate = [datetime]::ParseExact($r.hireDate, "yyyy-MM-dd", [Globalization.CultureInfo]::InvariantCulture)
              Invoke-FmQuery $connection 'INSERT INTO "社員情報" ("社員ID", "社員名_姓", "社員名_名", "社員名_姓カナ", "社員名_名カナ", "雇用形態", "打刻ID", "入社日") VALUES (?, ?, ?, ?, ?, ?, ?, ?)' @($employeeId, $r.lastName, $r.firstName, $r.lastNameKana, $r.firstNameKana, $r.employmentType, $r.employeeNumber, $hireDate)
            }
            $results.Add(@{id=$job.id;file=$file;step="checked";fmStatus=[string]$employeeId})
            continue
          }
          $status = Invoke-FmQuery $connection "SELECT status FROM gardenaccountrequest WHERE requestid = ?" @($requestId) -Scalar
          if ($kind -eq "jobs") {
            # POST acknowledgement may have been lost: never insert a second row.
            if ($null -eq $status) {
              Invoke-FmQuery $connection "INSERT INTO gardenaccountrequest (requestid, accountname, password, status) VALUES (?, ?, ?, 'pending')" @($requestId, $job.accountName, $job.password)
              $status = "pending"
            } elseif ([string]$status -ne "pending" -and [string]$status -ne "0") {
              # Explicit Garden retry reuses the failed row; DELETE is unavailable.
              Invoke-FmQuery $connection "UPDATE gardenaccountrequest SET accountname = ?, password = ?, status = 'pending' WHERE requestid = ?" @($job.accountName, $job.password, $requestId)
              $status = "pending"
            }
            $results.Add(@{id=$job.id;file=$file;step="sent"})
          }
          if ($null -eq $status -and $kind -eq "checks") { throw "Request row missing" }
          if ([string]$status -ne "pending") { $results.Add(@{id=$job.id;file=$file;step="checked";fmStatus=[string]$status}) }
        } catch {
          # Do not include ODBC exception text: it can contain SQL/credentials.
          # Leave waiting/sent unchanged so the next scheduled run retries automatically.
          Write-AgentLog ("ODBC failed: " + $job.id + " " + $file)
        } finally {
          if ($connection) { $connection.Dispose() }
        }
      }
    }
  }
  if ($results.Count -gt 0) {
    $body = @{results=@($results.ToArray())} | ConvertTo-Json -Depth 8 -Compress
    Invoke-RestMethod -Uri $endpoint -Headers $headers -Method Post -ContentType "application/json; charset=utf-8" -Body ([Text.Encoding]::UTF8.GetBytes($body)) -TimeoutSec 60 | Out-Null
  }
  Write-AgentLog ("Completed: " + $results.Count + " results")
} catch {
  Write-AgentLog "Agent failed. Check config, environment variables and connectivity."
  $exitCode = 1
} finally {
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
exit $exitCode
