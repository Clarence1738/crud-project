param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [string]$Php = 'C:\xampp\php\php.exe',
    [int]$Port = 55439,
    [int]$BenchmarkRows = 0,
    [switch]$VerifyRestore
)
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path ([IO.Path]::GetTempPath()) ('nextrans-pg-test-' + [guid]::NewGuid().ToString('N'))
$testData = Join-Path $testRoot 'data'
$passwordFile = Join-Path $testRoot 'password'
$started = $false
$exitStatus = 1
$oldEnvironment = @{}
foreach ($key in @('DB_CONNECTION', 'DB_HOST', 'DB_PORT', 'DB_DATABASE', 'DB_USERNAME', 'DB_PASSWORD')) {
    $oldEnvironment[$key] = [Environment]::GetEnvironmentVariable($key, 'Process')
}
try {
    New-Item -ItemType Directory -Path $testRoot | Out-Null
    $testPassword = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
    [IO.File]::WriteAllText($passwordFile, $testPassword)
    & (Join-Path $PostgresBin 'initdb.exe') -D $testData -U nextrans_test -A scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --locale=C | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not initialize isolated PostgreSQL test cluster.' }
    Remove-Item -LiteralPath $passwordFile
    $launch = Start-Process -FilePath (Join-Path $PostgresBin 'pg_ctl.exe') -ArgumentList @(
        '-D', ('"' + $testData + '"'), '-l', ('"' + (Join-Path $testRoot 'server.log') + '"'),
        '-o', ('"-h 127.0.0.1 -p ' + $Port + '"'), '-w', 'start'
    ) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $testRoot 'startup.log') -RedirectStandardError (Join-Path $testRoot 'startup-error.log')
    $launch.WaitForExit()
    $started = $true
    & (Join-Path $PostgresBin 'pg_ctl.exe') -D $testData status | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not start isolated PostgreSQL test cluster.' }
    $started = $true
    $env:DB_CONNECTION = 'pgsql'
    $env:DB_HOST = '127.0.0.1'
    $env:DB_PORT = "$Port"
    $env:DB_DATABASE = 'postgres'
    $env:DB_USERNAME = 'nextrans_test'
    $env:DB_PASSWORD = $testPassword
    Push-Location (Join-Path $PSScriptRoot '../backend')
    try {
        & $Php -d extension=pdo_pgsql vendor/bin/phpunit
        $exitStatus = $LASTEXITCODE
        if ($exitStatus -ne 0) { throw 'PostgreSQL tests failed.' }
        if ($BenchmarkRows -gt 0) {
            & $Php -d extension=pdo_pgsql artisan shipments:benchmark --env=testing --rows=$BenchmarkRows
            if ($LASTEXITCODE -ne 0) { throw 'Shipment benchmark failed.' }
        }
    } finally { Pop-Location }
    if ($VerifyRestore) {
        $previousPgPassword = $env:PGPASSWORD
        try {
            $env:PGPASSWORD = $testPassword
            $connection = @('-h', '127.0.0.1', '-p', "$Port", '-U', 'nextrans_test')
            $psql = Join-Path $PostgresBin 'psql.exe'
            $privatePath = Join-Path $testRoot 'private'
            $restoredPath = Join-Path $testRoot 'restored-private'
            $archive = Join-Path $testRoot 'private.zip'
            $dump = Join-Path $testRoot 'database.dump'
            New-Item -ItemType Directory -Path $privatePath | Out-Null
            $source = Join-Path $privatePath 'proof.txt'
            [IO.File]::WriteAllText($source, 'Disposable backup verification file')
            $fixtureSql = @'
INSERT INTO users (name, email, password)
VALUES ('Backup verification', 'backup@example.test', 'unusable-fixture');
INSERT INTO documents (id, user_id, title, path, original_name, mime_type, size)
SELECT '11111111-1111-4111-8111-111111111111', id, 'Proof of delivery',
       'proof.txt', 'proof.txt', 'text/plain', 35
FROM users WHERE email = 'backup@example.test';
'@
            & $psql @connection -X -d postgres -v ON_ERROR_STOP=1 -c $fixtureSql | Out-Null
            if ($LASTEXITCODE -ne 0) { throw 'Could not create the disposable restore fixture.' }
            & (Join-Path $PostgresBin 'pg_dump.exe') @connection -Fc -f $dump postgres
            if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
            Compress-Archive -LiteralPath $source -DestinationPath $archive
            & (Join-Path $PostgresBin 'createdb.exe') @connection backup_verify
            if ($LASTEXITCODE -ne 0) { throw 'Could not create the disposable restore database.' }
            & (Join-Path $PostgresBin 'pg_restore.exe') @connection --exit-on-error -d backup_verify $dump
            if ($LASTEXITCODE -ne 0) { throw 'Database restore failed.' }
            Expand-Archive -LiteralPath $archive -DestinationPath $restoredPath
            $restoredFile = & $psql @connection -X -d backup_verify -tAc "SELECT path FROM documents WHERE title = 'Proof of delivery'"
            if ($LASTEXITCODE -ne 0 -or $restoredFile -ne 'proof.txt') { throw 'Restored document metadata is missing.' }
            if ((Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath (Join-Path $restoredPath $restoredFile)).Hash) {
                throw 'Restored private file differs from the original.'
            }
            Write-Output 'Backup restore verified: document metadata and its private file match.'
        } finally { $env:PGPASSWORD = $previousPgPassword }
    }
} finally {
    foreach ($key in $oldEnvironment.Keys) { [Environment]::SetEnvironmentVariable($key, $oldEnvironment[$key], 'Process') }
    if ($started) {
        & (Join-Path $PostgresBin 'pg_ctl.exe') -D $testData -m fast -w stop | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "Test server did not stop. Data retained at $testRoot" }
    }
    $resolved = [IO.Path]::GetFullPath($testRoot)
    $expected = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    if ($resolved.StartsWith($expected, [StringComparison]::OrdinalIgnoreCase) -and
        [IO.Path]::GetFileName($resolved).StartsWith('nextrans-pg-test-')) {
        Remove-Item -LiteralPath $resolved -Recurse -Force
    }
}
if ($exitStatus -ne 0) { throw "PostgreSQL tests failed with exit code $exitStatus" }
