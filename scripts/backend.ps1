param(
    [ValidateSet('serve', 'migrate', 'test', 'format', 'check')]
    [string]$Action = 'serve',
    [string]$Php = 'C:\xampp\php\php.exe'
)
$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '../backend')
try {
    switch ($Action) {
        'serve' {
            Push-Location public
            try {
                & $Php -d extension=pdo_pgsql -d upload_max_filesize=10M -d post_max_size=12M -S 127.0.0.1:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
            } finally { Pop-Location }
        }
        'migrate' { & $Php -d extension=pdo_pgsql artisan migrate }
        'test' { & $Php -d extension=pdo_pgsql vendor/bin/phpunit }
        'format' { & $Php vendor/bin/pint }
        'check' { & $Php vendor/bin/pint --test }
    }
    if ($LASTEXITCODE -ne 0) { throw "Backend command failed with exit code $LASTEXITCODE" }
} finally { Pop-Location }
