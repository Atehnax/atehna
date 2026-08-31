[CmdletBinding()]
param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'

function Read-LocalEnvironment {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Missing $Path. Localhost requires its gitignored local environment file."
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -notmatch '^([A-Z][A-Z0-9_]*)=(.*)$') { continue }
    $name = $Matches[1]
    $value = $Matches[2].Trim()
    if (
      $value.Length -ge 2 -and
      (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      )
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $values[$name] = $value
  }
  return $values
}

function Require-EnvironmentValue {
  param([hashtable]$Values, [string]$Name)
  $value = [string]$Values[$Name]
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "$Name is required in .env.development.local."
  }
  return $value
}

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$workspaceRoot = Split-Path -Parent $projectRoot
$environmentPath = Join-Path $projectRoot '.env.development.local'
$environmentValues = Read-LocalEnvironment -Path $environmentPath

$databaseUrl = Require-EnvironmentValue -Values $environmentValues -Name 'DATABASE_URL'
$databaseKeys = @(
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'SUPABASE_DB_URL',
  'E2E_DATABASE_URL'
)
foreach ($databaseKey in $databaseKeys) {
  $candidate = Require-EnvironmentValue -Values $environmentValues -Name $databaseKey
  if ($candidate -ne $databaseUrl) {
    throw "$databaseKey must match DATABASE_URL exactly for isolated localhost use."
  }
}

try {
  $databaseUri = [System.Uri]$databaseUrl
} catch {
  throw 'DATABASE_URL is not a valid PostgreSQL URL.'
}
if ($databaseUri.Scheme -notin @('postgres', 'postgresql')) {
  throw 'DATABASE_URL must use the postgres or postgresql scheme.'
}
if ($databaseUri.Host.ToLowerInvariant() -notin @('127.0.0.1', 'localhost', '::1')) {
  throw 'Refusing to start localhost with a non-loopback database.'
}

$storageNamespace = Require-EnvironmentValue -Values $environmentValues -Name 'E2E_STORAGE_NAMESPACE'
if ($storageNamespace -notmatch '^[a-z0-9][a-z0-9-]{10,50}[a-z0-9]$') {
  throw 'E2E_STORAGE_NAMESPACE is invalid.'
}
$expectedDatabaseName = 'atehna_e2e_' + $storageNamespace.Replace('-', '_')
$databaseName = [System.Uri]::UnescapeDataString($databaseUri.AbsolutePath.Trim('/'))
if ($databaseName -ne $expectedDatabaseName) {
  throw "Refusing database '$databaseName'; expected '$expectedDatabaseName'."
}

$databasePort = if ($databaseUri.IsDefaultPort) { 5432 } else { $databaseUri.Port }
$databaseUser = [System.Uri]::UnescapeDataString(($databaseUri.UserInfo -split ':', 2)[0])
if ([string]::IsNullOrWhiteSpace($databaseUser)) {
  throw 'DATABASE_URL must include an explicit PostgreSQL user.'
}
foreach ($entry in $environmentValues.GetEnumerator()) {
  Set-Item -Path ('Env:' + $entry.Key) -Value $entry.Value
}

$postgresBin = Join-Path $workspaceRoot '.tools\postgresql-17.11\pgsql\bin'
$pgControl = Join-Path $postgresBin 'pg_ctl.exe'
$pgIsReady = Join-Path $postgresBin 'pg_isready.exe'
$postgresData = Join-Path $workspaceRoot 'local-runtime\localhost\pgdata'
$postgresLog = Join-Path $workspaceRoot 'local-runtime\localhost\postgres.log'
foreach ($requiredPath in @($pgControl, $pgIsReady, (Join-Path $postgresData 'PG_VERSION'))) {
  if (-not (Test-Path -LiteralPath $requiredPath -PathType Leaf)) {
    throw "Missing localhost PostgreSQL runtime file: $requiredPath"
  }
}

& $pgIsReady -h 127.0.0.1 -p $databasePort -d $databaseName -U $databaseUser | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Starting isolated PostgreSQL on 127.0.0.1:$databasePort ..."
  $serverOptions = "-p $databasePort -h 127.0.0.1"
  & $pgControl -D $postgresData -l $postgresLog -o $serverOptions -w start
  if ($LASTEXITCODE -ne 0) {
    throw "PostgreSQL did not start. See $postgresLog"
  }
}

Push-Location $projectRoot
try {
  & node scripts/e2e-database.mjs check
  if ($LASTEXITCODE -ne 0) {
    throw 'The localhost database failed its non-destructive schema check.'
  }

  $listeners = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue)
  if ($listeners.Count -gt 0) {
    if ($listeners | Where-Object { $_.LocalAddress -ne '127.0.0.1' }) {
      throw "Port $Port is listening beyond 127.0.0.1. Stop that process before using dev:local."
    }
    try {
      $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/e2e/health" -TimeoutSec 10
    } catch {
      throw "Port $Port is occupied, but the Atehna localhost health check failed."
    }
    if (
      $health.ok -ne $true -or
      $health.databaseIdentity.database -ne $expectedDatabaseName -or
      $health.databaseIdentity.serverAddress -notin @('127.0.0.1', 'localhost', '::1')
    ) {
      throw "Port $Port is not serving the expected isolated Atehna localhost."
    }
    Write-Host "Atehna is already healthy at http://127.0.0.1:$Port"
    return
  }

  $npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
  Write-Host "Starting Atehna at http://127.0.0.1:$Port ..."
  & $npmCommand run dev -- --hostname 127.0.0.1 --port $Port
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
