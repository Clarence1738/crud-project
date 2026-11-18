# Nextrans secure CRUD

Angular 21 frontend with native Angular templates and HTML controls and Laravel 12 backend, using PostgreSQL.
The existing transport register is retained. Private documents have their own CRUD
screen. Records and files belong to individual accounts.

## Local setup

Prerequisites: Node compatible with Angular 21, Composer, PHP 8.2+ (including
fileinfo, mbstring, PDO and pdo_pgsql), and PostgreSQL. Laravel 12 was selected for
the installed PHP 8.2 runtime. Do not bypass Composer platform requirements.

From this folder:

1. Run npm.cmd ci.
2. In backend, run composer install. Copy .env.example to .env only if .env is
   absent, then run php artisan key:generate.
3. Create a dedicated PostgreSQL database and application role. Set DB_HOST,
   DB_PORT, DB_DATABASE, DB_USERNAME and DB_PASSWORD in backend/.env.
   The defaults are crud-project and crud_project_app. No database password is
   supplied or committed. Use a separate test database for PostgreSQL tests.
4. Run the commands below in PowerShell, with separate terminals for the servers:

   ./scripts/backend.ps1 migrate
   ./scripts/backend.ps1 serve
   npm.cmd start

Open http://localhost:4200 and create an account. Keep the same hostname throughout
a session. The Angular dev proxy forwards /api to Laravel at 127.0.0.1:8000.
The helper enables XAMPP's existing pdo_pgsql extension for its process; it does
not edit your global PHP configuration. If pgsql is already enabled, remove the
extra extension switch to avoid a duplicate-module warning. You can instead run
ordinary Artisan commands using your configured PHP.

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

GET/POST /api/transports and GET/PUT/DELETE /api/transports/{id} manage owned
transport records. Lists are paginated (50 per page). Search, filters and summary
counts currently apply to the displayed transport page.

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

Local database provisioning: run ./scripts/setup-database.ps1. It prompts securely for the existing PostgreSQL administrator password, creates the application role and database, and runs migrations. The generated application password is stored only in ignored backend/.env. Existing databases and roles are not overwritten.
