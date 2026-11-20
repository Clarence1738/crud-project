# Firm Management System

Angular 21 frontend with a DevExtreme DataGrid for the transport register, a Laravel 12 backend, and PostgreSQL.
Private documents have their own CRUD
screen. Records and files belong to individual accounts.

The transport grid, transport dialogs, and document delete confirmation use DevExtreme 26.1.
During evaluation, DevExtreme can show a trial warning.
Register a valid key for production use. [DevExtreme licensing](https://js.devexpress.com/Angular/Documentation/Guide/Common/Licensing/)

## Local setup on Windows

Install Node.js 22.12+ (within the 22.x release line) or 24+, XAMPP with PHP 8.2+
at `C:\xampp`, and PostgreSQL 18. Keep the password you set for the PostgreSQL
administrator (`postgres`). During [Composer for Windows](https://getcomposer.org/download/)
setup, select `C:\xampp\php\php.exe`, then open a new PowerShell terminal so it
picks up Composer on your PATH.

### 1. Install dependencies and configure Laravel

Run these commands from the project root (the folder containing `package.json`):

```powershell
npm.cmd ci
Set-Location backend
composer install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
if (Select-String -Path .env -Pattern '^APP_KEY=\s*$' -Quiet) {
    & C:\xampp\php\php.exe artisan key:generate
}
Set-Location ..
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` as shown. If `composer` is
unrecognized, install Composer and reopen PowerShell. If Composer reports that
ZIP support is missing, open `C:\xampp\php\php.ini`, uncomment `extension=zip`,
and rerun `composer install` from `backend` before continuing.

### 2. Set up PostgreSQL

Check the PostgreSQL service with `Get-Service postgresql-x64-18`. If it is
stopped, run `Start-Service postgresql-x64-18` in an administrator PowerShell.

For a new database, run this command and paste its output after `DB_PASSWORD=`
in `backend/.env`. Leave the other database settings at their defaults.

```powershell
& C:\xampp\php\php.exe -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
```

From the project root, run the setup script and enter the PostgreSQL administrator
password at the hidden prompt. The script creates the `crud-project` database
and its `crud_project_app` role, then runs Laravel's migrations.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-database.ps1
```

If the database and role already exist, keep their existing credentials in
`backend/.env` and run the migrations directly:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\backend.ps1 migrate
```

### 3. Start the app

From the project root, start Laravel in one PowerShell window:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\backend.ps1 serve
```

Keep it open and start Angular in a second PowerShell window:

```powershell
npm.cmd start
```

Open **http://localhost:4200** and create an account. Angular forwards `/api`
requests to Laravel at `http://127.0.0.1:8000`. The backend script loads XAMPP's
`pdo_pgsql` extension for the PHP process. The execution policy flag applies
only to the PowerShell process launched for each script.

The old demo password and browser-storage login are removed. Existing localStorage
transport data is not imported or deleted: ownership of that old shared data
cannot be established safely. New records are stored by the backend.

## Checks

    npm.cmd test -- --watch=false
    npm.cmd run build
    npm.cmd run format:check
    ./scripts/backend.ps1 test
    ./scripts/backend.ps1 check

Backend tests use an isolated in-memory SQLite database by default, fake private
storage, and test-only users. They cover registration, password hashing, login,
logout, rate limiting, ownership on all operations, upload validation, file
replacement/deletion and CSRF rejection. SQLite tests do not prove PostgreSQL
connectivity. For PostgreSQL integration testing, override DB_CONNECTION and
DB_DATABASE with a disposable test database; RefreshDatabase resets its schema.
Alternatively run ./scripts/test-postgres.ps1 to create, test and remove an isolated temporary PostgreSQL cluster automatically (requires the PostgreSQL binaries). This does not use your application database credentials.

Never run that suite against production or a database holding real records.

## API and security design

All /api routes use Laravel's web session and CSRF middleware. GET /api/csrf
returns a token stored only in frontend memory. Mutations send X-CSRF-TOKEN.
Session cookies are HttpOnly and SameSite=Lax. Login and registration regenerate
the session ID; logout invalidates it. There are no browser-stored bearer tokens
or client-side passwords. Passwords use Laravel's hashed model cast.

POST /api/register and /api/login establish a session; GET /api/me returns the
current user and POST /api/logout ends the session. Login/registration are rate
limited. All data routes require authentication.

The workspace opens on **Transport** for incoming deliveries and outgoing shipments.
Use **Due today**, **Overdue**, or **Missing ETA** to filter open shipments using the
Nairobi business date. Search runs across the signed-in account before pagination.
The status chart still summarizes the current page.
GET/POST /api/transports and GET/PUT/DELETE /api/transports/{id} manage the signed-in user's
transport records. The **Arrival calendar** shows expected arrival dates and opens
shipment details when you select an entry. PATCH /api/transports/{id}/status updates
the status. Shipment details show history recorded since the upgrade and the actual
delivery timestamp for shipments marked delivered after the upgrade.
Existing records are available in the Transport register.
New and edited shipments require sending and receiving company names as well as their
origin and destination locations. Older shipments show missing company names until edited.
Shipment reference, goods description, quantity, and expected arrival date are optional.
Select **View details** in the shipment grid to open `/shipments/{id}` and see its schedule,
goods, status history, and documents. Use the browser Back button or **Back to shipments**
to return to the register. Upload attachments from the details view. If a shipment is deleted, its
attachments become general Private documents for the same account.

## Code organization and scaling

- Angular loads the register, shipment details, and private documents through routes.
  Separate components own the shipment editor and arrival calendar.
- Laravel's shipment module contains `TransportQueries` for account-scoped reads and
  `TransportStatusService` for shipment writes and history in a single transaction.
  The document module owns private file writes. HTTP controllers handle authorization,
  validation, and response formatting.
- GitHub Actions builds and tests Angular and runs the Laravel suites with SQLite and
  a disposable PostgreSQL service.

Run the PostgreSQL suite, benchmark, and restore check from the project root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\test-postgres.ps1 -BenchmarkRows 5000 -VerifyRestore
```

This uses an isolated local PostgreSQL cluster. The benchmark measures register,
reference search, and calendar queries and prints query plans. The restore check
recreates document metadata and verifies the matching private file by checksum.
For a real backup, take the database dump and the private-storage copy from the same
consistent point and restore them to an isolated environment before relying on them.

GET/POST /api/documents and GET/PUT/DELETE /api/documents/{id} manage documents.
Uploads use multipart POST; updates use POST with _method=PUT for PHP multipart
compatibility. GET /api/documents/{id}/download authorizes the owner before
streaming an attachment. Cross-owner object access returns 404. Ownership comes
from the authenticated session; user_id and document path input are prohibited.

Allowed uploads: PDF, PNG, JPEG, TXT and CSV, up to 10 MB. Backend validation checks
content MIME types and extensions. Configure PHP upload_max_filesize >= 10M,
post_max_size > 10M and the reverse proxy body limit accordingly.
Uploaded files are random-named under backend/storage/app/private, outside the
public directory. Do not expose this folder or add a public storage symlink for
it. Database failures during upload clean up newly written files.

## Deployment

Build Angular with npm.cmd run build and install backend production dependencies
with composer install --no-dev --optimize-autoloader. Configure PHP-FPM or Apache
with backend/public as its document root. Never serve the repository root.

Use one HTTPS origin: reverse-proxy /api/* to Laravel (preserving cookies and
headers), and other application requests to the built Angular Node server:
npm.cmd run serve:ssr:crud-project. The Node server does not implement the API.

Configure APP_ENV=production, APP_DEBUG=false, APP_URL, a unique APP_KEY,
SESSION_SECURE_COOKIE=true and a dedicated database account. Add your frontend
hostname to angular.json security.allowedHosts before building. Store secrets
outside source control. Run migrations, then php artisan config:cache.

Back up both PostgreSQL and private storage and test restores together. Restrict
filesystem access, monitor failed requests/storage failures, and review dependency
updates. A malware scanner, account recovery and email verification are not
implemented. No production deployment has been performed.
