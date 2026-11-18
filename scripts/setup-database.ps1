param(
    [string]$Psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe',
    [string]$AdminUser = 'postgres'
)
$ErrorActionPreference = 'Stop'
$envFile = Join-Path $PSScriptRoot '../backend/.env'
$settings = [IO.File]::ReadAllText($envFile)
$passwordMatch = [regex]::Match($settings, '(?m)^DB_PASSWORD=([a-f0-9]{64})\r?$')
if (-not $passwordMatch.Success) { throw 'Expected the generated application password in backend/.env.' }
$appPassword = $passwordMatch.Groups[1].Value
$adminSecret = Read-Host "Enter PostgreSQL password for $AdminUser (hidden)" -AsSecureString
$oldPgPassword = $env:PGPASSWORD
$pointer = [IntPtr]::Zero
try {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminSecret)
    $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $existing = & $Psql -X -w -h 127.0.0.1 -p 5432 -U $AdminUser -d postgres -tAc "SELECT (SELECT count(*) FROM pg_roles WHERE rolname='crud_project_app') + (SELECT count(*) FROM pg_database WHERE datname='crud-project');"
    if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL administrator authentication failed.' }
    if ([int]$existing.Trim() -ne 0) { throw 'The target role or database already exists. Stopped without changing it.' }
    $sql = "CREATE ROLE crud_project_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD '$appPassword';" +
        'CREATE DATABASE "crud-project" OWNER crud_project_app;' +
        'REVOKE ALL ON DATABASE "crud-project" FROM PUBLIC;'
    $sql | & $Psql -X -w -h 127.0.0.1 -p 5432 -U $AdminUser -d postgres -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Database setup failed. Inspect the database and role before retrying.' }
} finally {
    $env:PGPASSWORD = $oldPgPassword
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    $adminSecret.Dispose()
}
& (Join-Path $PSScriptRoot 'backend.ps1') migrate
