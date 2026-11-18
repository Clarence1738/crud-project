param(
    [string]$PostgresBin = 'C:\Program Files\PostgreSQL\18\bin',
    [string]$Php = 'C:\xampp\php\php.exe',
    [int]$Port = 55439
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
    } finally { Pop-Location }
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
