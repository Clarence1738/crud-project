# Farm Management System

Farm operations workspace for Kenyan crop and livestock farms: Angular 21 with
DevExtreme 26.1, a Laravel 12 API, and PostgreSQL 18. Users create farms, invite
Managers and Workers, and record fields, crop seasons, crop activities,
livestock, animal health, inventory, tasks, equipment, and KES finance. All farm
records are scoped to the farms the signed-in user is a member of.

The project began as a shipment and private-document system. The shipment
module is retained in the source tree and API but is not currently linked from
the Angular routes or sidebar (see [Retained shipment module](#retained-shipment-module)).
Private documents remain available from the **Documents** screen.

Requirements, functional specification, design, and decisions are in
[`docs/farm-management-system`](docs/farm-management-system), with PDF editions in
[`docs/farm-management-system/pdf`](docs/farm-management-system/pdf).
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
replacement/deletion, CSRF rejection, farm isolation, farm roles, invitations,
and crop and livestock archiving. SQLite tests do not prove PostgreSQL
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

## Farm application

After login the app opens `/dashboard`. The sidebar groups the screens by
area: Overview, Farm setup, Crops, Livestock, Resources, Finance, Information,
and Administration. On smaller screens the sidebar becomes a drawer.

Every screen works on one **active farm**, chosen from the farm picker. The
choice is remembered in the browser across reloads, used only while the user is
still a member of that farm, and cleared on logout.

| Screen | What it does |
|---|---|
| Dashboard | Active crop seasons, active livestock count, crop records, farm size, land utilization chart, livestock summary. Reminders for overdue tasks, health due, low stock, maintenance due, and this month's income and expenses (Owner). Archived records are excluded. |
| Farms | Farm cards with the user's role, farm details (Owner edits), members, invitations, and joining another farm with a code. |
| Crops | Crop seasons on a field: add, edit, archive, restore, show archived. Crop area cannot exceed the field size. |
| Livestock | Individual animals (unique tag per farm) and groups or flocks: add, edit, archive, restore. |
| Crop activities | Land preparation, planting, irrigation, fertilizer, spraying, scouting, weeding, and harvesting against an open crop season, with KES cost. |
| Animal health | Vaccination, treatment, diagnosis, deworming, and check-ups for active animals, with medicine, cost, and next due date. |
| Fields, Inventory, Equipment | Configurable lists with add and edit. |
| Tasks | Priority, due date, status, and an assignee chosen from farm members. |
| Finance | KES income and expense records (Owner only). |
| Documents | Account-private file upload, rename, replace, download, and delete. |

### Further screens

Every function in the specification (FMS-FS v1.0) is now saved through the API
with the same farm membership and role checks as the screens above.

| Screen | Route | Who can add | Notes |
|---|---|---|---|
| Harvests | /harvests | Owner, Manager | Adds the quantity to the crop season's harvested kg; editing adjusts it. |
| Losses and incidents | /incidents | Owner, Manager | Pests, disease, weather, theft, with loss and action taken. |
| Breeding, Births | /breeding, /births | Owner, Manager | Active animals of the farm only; expected birth after breeding date. |
| Weight and production | /production | Any member | Milk, eggs, weight and wool measurements. |
| Stock movements | /movements | Any member | Receipts, issues and transfers update the item balance; an issue cannot exceed stock. Adjustments need Owner or Manager and a reason. Movements cannot be edited. |
| Suppliers, Stock locations | /suppliers, /locations | Owner, Manager | Names are unique per farm and used as choices on movements and harvests. |
| Maintenance | /maintenance | Owner, Manager | Updates the equipment's next service date. |
| Reports R1 to R7 | /reports | Owner, Manager | Charts and CSV export; R7 needs finance access. |
| Audit history | /audit | Owner only (read) | Farm, crop, livestock, operations, membership and settings changes. |
| Settings | /settings | Owner edits, members read | Reminder window for the dashboard, and finance access for Managers. |
| System admin | /admin | System Administrators | Lists accounts; suspend or reactivate. Suspended accounts are signed out and cannot sign in. |
| Functional coverage | /coverage | All | Maps every FS use case and report to its screen. |

Give an account the System Administrator role from the `backend` folder:

```powershell
C:\xampp\php\php.exe -d extension=pdo_pgsql artisan farm:make-admin someone@example.com
```

### Roles and collaboration

The farm creator is its **Owner**. The Owner invites people as **Manager** or
**Worker** from the Farms screen. An invitation produces a one-time code, shown
once, which expires after 7 days. The invitee signs in with the invited e-mail
address and enters the code. No e-mail is sent; the Owner shares the code.
Only a SHA-256 hash of the code is stored.

| Capability | Owner | Manager | Worker |
|---|:-:|:-:|:-:|
| View dashboard and operational records | Yes | Yes | Yes |
| Record crop activities and animal health events | Yes | Yes | Yes |
| Add, edit, archive crops, livestock, fields, inventory, equipment, tasks | Yes | Yes | No |
| Update status of tasks assigned to them | Yes | Yes | Yes |
| Finance records | Yes | No | No |
| Edit farm details, invite, change roles, remove members | Yes | No | No |
| Leave the farm | No | Yes | Yes |

Laravel enforces these rules in `App\Farms\FarmAccess`; the Angular interface
hides actions the role cannot use. Non-members receive 404 for a farm's records,
and members without the capability receive 403. Removing a member unassigns
their tasks. Audit logging and a System Administrator role are not implemented.

### Farm API

| Method and path | Purpose |
|---|---|
| `GET/POST /api/farms`, `PUT /api/farms/{farm}` | List farms with the user's role; create (creator becomes Owner); edit (Owner) |
| `GET /api/farms/{farm}/overview` | Dashboard totals and land utilization |
| `GET/POST /api/farms/{farm}/crops`, `PUT .../crops/{crop}`, `PATCH .../crops/{crop}/archive` | Crop seasons; `?archived=1` lists archived records |
| `GET/POST /api/farms/{farm}/livestock`, `PUT .../livestock/{id}`, `PATCH .../livestock/{id}/archive` | Livestock records |
| `GET/POST /api/farms/{farm}/operations/{module}`, `PUT .../operations/{module}/{record}` | Modules: `fields`, `activities`, `health`, `inventory`, `tasks`, `equipment`, `finance` |
| `PATCH /api/farms/{farm}/tasks/{task}/status` | Task status change (Workers: own assigned tasks) |
| `GET /api/farms/{farm}/members`, `PATCH/DELETE .../members/{user}` | Members, role change, removal or leaving |
| `GET/POST /api/farms/{farm}/invitations`, `DELETE .../invitations/{id}` | Pending invitations, create, revoke (Owner) |
| `POST /api/farm-invitations/accept` | Accept an invitation code |

Linked records must belong to the same farm: an activity needs an open crop
season (not archived, completed, or cancelled), a health event needs an active,
unarchived animal, and a task assignee must be a farm member.

Farm code lives in `src/app/farm-*.ts`, `src/app/farm.service.ts`,
`backend/app/Farms`, `backend/app/Http/Controllers/Farm*Controller.php`, and the
`2026_11_23_*` and `2026_11_25_*` migrations. Tests are in
`backend/tests/Feature/FarmManagementTest.php`,
`backend/tests/Feature/FarmCollaborationTest.php`, and
`src/app/farm.service.spec.ts`.

## Retained shipment module

The shipment features below remain implemented in Angular components
(`transports`, `shipment-editor`, `shipment-details`, `arrival-calendar`,
`delivery-analytics`, `dashboard`) and in the Laravel API, but no current route
or sidebar item opens them. They are kept intentionally and should not be
removed without a product decision.

### Shipment register

The **Shipments** screen manages incoming deliveries and outgoing shipments.
Use **Due today**, **Overdue**, or **Missing ETA** to filter open shipments using the
Nairobi business date. Search runs across the signed-in account before pagination.
The status chart summarizes the current page.

The DevExtreme register supports row highlighting, column resizing, column
reordering, a column chooser, header filters, filter rows, and grouping by
dragging a column into the group panel. Server-side search and pagination remain
the source of truth for the complete account register.

New and edited shipments record:

- Sending and receiving companies
- Origin and destination
- Vehicle registration
- Optional driver name and phone number
- Departure and expected-arrival dates
- Status: Scheduled, In transit, or Delivered
- Optional shipment reference, goods description, and quantity
- Private internal operational notes

If a reference is not supplied, Laravel generates one in the form
SHP-YYMMDD-XXXXX. The **Arrival calendar** shows expected arrivals and opens the
selected shipment. **Delivery analytics** reports on-time delivery, promised ETA
coverage, and transit-time measures. **Export CSV** downloads the active account's
shipment register.

GET/POST /api/transports and GET/PUT/DELETE /api/transports/{id} manage the
signed-in user's shipment records. PATCH /api/transports/{id}/status updates a
status without replacing the rest of the record. GET /api/transports/export
downloads CSV data.

Deleting from the interface is implemented as an archive operation. Archived
shipments are removed from active lists, calendars, analytics, and exports, but
their shipment data and linked documents remain stored.

### Shipment details

Select **View details** in the shipment grid to open `/shipments/{id}` and see its schedule,
companies, driver contact, goods, internal notes, status history, and documents.
A visual progress stepper shows Scheduled, In transit, and Delivered stages.
The actual delivery timestamp and transit-day calculation appear after delivery.
Use **Print summary** for a print-friendly shipment record. Use the browser Back
button or **Back to shipments** to return to the register. Attachments can be
uploaded from the details view.

### Documents

The **Documents** screen manages account-private files, while the shipment detail
screen manages files linked to a specific shipment. Users can upload, rename,
replace, download, paginate, and delete their own documents. Delete confirmation
uses a DevExtreme popup.

## Code organization and scaling

- Angular loads the register, shipment details, and private documents through routes.
  The dashboard, shipment editor, arrival calendar, delivery analytics, documents,
  and shipment details are separate lazy-loaded or deferred components.
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
