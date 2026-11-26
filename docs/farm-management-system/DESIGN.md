# Farm Management System

## System Design

| Document control | |
|---|---|
| Document ID | FMS-DES |
| Version | 1.0 |
| Date | 25 November 2026 |
| Status | Issued for review |
| Baseline | FMS-URS v1.0 and FMS-FS v1.0 |
| Related documents | FMS-DEC v1.0 Decision Log |

## 1. Architecture

| Layer | Technology | Responsibility |
|---|---|---|
| Browser application | Angular 21, standalone components, signals, DevExtreme 26.1 | Screens, forms, grids, charts, active farm selection |
| Development proxy | Angular dev server on port 4200 | Forwards /api requests to Laravel |
| API | Laravel 12 on PHP 8.2 or later, port 8000 | Session authentication, CSRF, validation, farm authorization, persistence |
| Database | PostgreSQL 18 (SQLite in automated tests) | Farm, membership, and operational records |
| File storage | Laravel private disk outside the public web root | Private documents |

Sessions use HttpOnly cookies. The CSRF token is held only in browser memory
and sent with every changing request. No bearer tokens or passwords are stored
in the browser. The only farm value kept in browser storage is the identifier of
the active farm, which grants no access by itself.

## 2. Portal sitemap

| Area | Route | Status |
|---|---|---|
| Dashboard | /dashboard | Implemented |
| Farms, members, invitations | /farms | Implemented |
| Crop seasons | /crops | Implemented |
| Livestock | /livestock | Implemented |
| Crop activities | /activities | Implemented |
| Animal health | /health | Implemented |
| Fields | /fields | Implemented |
| Inventory | /inventory | Implemented |
| Tasks | /tasks | Implemented |
| Equipment | /equipment | Implemented |
| Finance | /finance | Implemented (Owner only) |
| Documents | /documents | Implemented (account private) |
| Reports | Not yet routed | Planned |
| Settings | Not yet routed | Planned |

## 3. Data model

All operational tables carry farm_id, created_at, and updated_at. Identifiers
are UUIDs except users and memberships.

| Table | Purpose | Key columns |
|---|---|---|
| farms | Farm business units | id, owner_id, name, county, location, size_hectares, notes |
| farm_memberships | User access to farms | farm_id, user_id, role (unique per farm and user) |
| farm_invitations | Pending and accepted invitations | farm_id, email, role, token_hash (unique), invited_by, expires_at, accepted_at, accepted_by |
| farm_fields | Fields and plots | name (unique per farm), size_hectares, soil_type, status, notes |
| crop_seasons | Crop plantings | field_id, crop, variety, field_name, area_hectares, planted_on, expected_harvest_date, status, expected_yield_kg, harvested_kg, notes, archived_at |
| crop_activities | Work on a crop season | crop_season_id, type, activity_date, cost_kes, notes |
| livestock_records | Animals and groups | tracking_type, tag_number (unique per farm), group_name, species, breed, sex, quantity, birth_date, status, location, notes, archived_at |
| livestock_events | Animal health events | livestock_record_id, type, event_date, next_due_date, medicine, cost_kes, notes |
| inventory_items | Stock items | name (unique per farm), category, unit, quantity, reorder_level, expires_on |
| farm_tasks | Work items | assignee_id, title, priority, due_date, status, notes |
| farm_equipment | Equipment | name, category, status, next_service_date, maintenance_cost_kes |
| farm_transactions | Income and expenses | type, category, transaction_date, amount_kes, party, notes |

### 3.1 Relationships

| Parent | Child | Rule on parent deletion |
|---|---|---|
| users | farms (owner_id) | Cascade |
| farms | farm_memberships, farm_invitations, and all operational tables | Cascade |
| users | farm_memberships | Cascade |
| farm_fields | crop_seasons (field_id) | Set null; field_name is retained on the season |
| crop_seasons | crop_activities | Cascade |
| livestock_records | livestock_events | Cascade |
| users | farm_tasks (assignee_id) | Set null |

The interface does not physically delete farm records. Crop seasons and
livestock records are archived with archived_at.

### 3.2 Planned data model

These tables implement the Planned and Partial functions in FMS-FS. Each
carries farm_id, timestamps, and the farm scoping rules in section 4.

| Table | Purpose | Key columns | Requirements |
|---|---|---|---|
| crop_harvests | Harvest records per season | crop_season_id, harvest_date, quantity_kg, grade, loss_kg, destination, storage_location | URS-C06, C07 |
| crop_incidents | Pests, disease, weather, losses | crop_season_id, type, incident_date, affected_area_ha, loss_kg, description, corrective_action | URS-C05 |
| activity_inputs | Items used by an activity | crop_activity_id, inventory_item_id, quantity, stock_movement_id | URS-C04, I03 |
| breeding_events | Breeding and pregnancy | female_id, sire_id, bred_on, method, pregnancy_result, expected_birth_on | URS-L05 |
| birth_events | Births and offspring | breeding_event_id, born_on, born_alive, born_dead | URS-L05 |
| livestock_measurements | Weight and production | livestock_record_id, measured_on, kind, value, unit | URS-L03 |
| stock_locations | Stores and sheds | name | URS-I01 |
| suppliers | Suppliers and buyers | name, phone, email | URS-I01, F01 |
| stock_movements | Receipts, issues, transfers, adjustments | inventory_item_id, type, quantity, moved_on, location_id, to_location_id, unit_cost_kes, supplier_id, linked_type, linked_id, reason, actor_id | URS-I02, I04, I05 |
| maintenance_records | Equipment service history | farm_equipment_id, serviced_on, work_done, provider, cost_kes, parts, downtime_hours, next_service_date | URS-E01 |
| farm_documents | Files linked to farm records | document_id, linked_type, linked_id | URS-M01, M02 |
| audit_events | Change history | actor_id, action, record_type, record_id, changes (JSON), occurred_at | URS-A03 |
| farm_settings | Per farm options | manager_finance_access, reminder_days | URS-D02, decision O-01 |

Existing tables gain: crop_seasons.responsible_id; livestock_records.source,
dam_id, sire_id, exit_date, exit_reason; livestock_events.diagnosis, dose,
withdrawal_days, provider; farm_equipment.service_interval_days;
farm_transactions.payment_reference, product, quantity, unit_price_kes,
payment_status, crop_season_id, livestock_record_id.

### 3.3 Design of planned functions

| Function | Design |
|---|---|
| Stock balance | Balance is the sum of signed stock movements per item and location; the stored quantity becomes a cached value updated in the same transaction as each movement. Issues lock the item row and are refused if they exceed the balance. |
| Activity inputs | Saving an activity with inputs creates its stock issues in one database transaction, so the balance changes exactly once or not at all. |
| Reminders | A dashboard query selects health events, breeding, maintenance, and tasks due within the farm's reminder window (default 7 days) or overdue, using the Africa/Nairobi date. No background job is required. |
| Reports | Each report is a farm scoped query service returning rows and totals; the CSV export calls the same service with the same filters, so screen and file always match. |
| Audit | A shared recorder writes an audit event in the same transaction as each create, update, archive, membership, stock, and finance change, storing changed fields only. |
| Archiving | archived_at is added to remaining operational tables; list, dashboard, and report queries exclude archived rows by default. |

## 4. Access design

1. Every farm request resolves one farm from the URL.
2. The FarmAccess service looks up the user's membership for that farm. No
   membership returns 404.
3. The requested capability is checked against the role. A missing capability
   returns 403.
4. Queries filter by farm_id before any other condition.
5. Linked identifiers (crop season, livestock record, field, assignee) are
   validated against the same farm.
6. Archived and closed records are rejected as targets of new activity.

| Capability | Roles |
|---|---|
| view | Owner, Manager, Worker |
| record activity | Owner, Manager, Worker |
| manage records | Owner, Manager |
| finance | Owner |
| manage farm | Owner |

The Angular application mirrors these capabilities in farmCan to hide actions,
but relies on the API for enforcement.

## 5. Application components

| Component | Responsibility |
|---|---|
| App shell (app.ts) | Sign in, navigation, sign out, clearing the active farm |
| FarmService | Typed API calls, active farm persistence, role capability helpers |
| FarmWorkspace | Dashboard, farm cards, crop seasons, livestock, edit and archive dialogs |
| FarmMembers | Members, role changes, invitations, joining with a code |
| FarmModule | Configuration driven lists and forms for fields, activities, health, inventory, tasks, equipment, finance |
| FarmAccess (Laravel) | Membership and capability checks |
| FarmController | Farms, dashboard overview, crop seasons, livestock |
| FarmOperationsController | Operational modules and task status |
| FarmMemberController | Members and invitations |

## 6. Demonstration data

| Category | Demonstration data |
|---|---|
| Farms | Green Valley Farm in Nakuru; Sunrise Farm in Kiambu |
| Crops | Maize, beans, potatoes, tomatoes |
| Crop varieties | H614D, Rosecoco, Shangi, Anna F1 |
| Dairy cattle | Friesian, Ayrshire |
| Goats | Galla, dairy goat |
| Sheep | Dorper |
| Poultry | Layers, broilers |

Demonstration data is editable.

## 7. Release phases

| Phase | Scope | Status |
|---|---|---|
| 1. Foundation | Accounts, farms, farm selector, memberships, roles, documents | Delivered except audit log and System Administrator |
| 2. Crop operations | Fields, seasons, activities, archiving | Delivered; varieties configuration, inputs, harvest records, and reports planned |
| 3. Livestock operations | Animals, groups, flocks, health, archiving | Delivered; breeding, births, and production planned |
| 4. Farm resources | Inventory, tasks with assignment, equipment | Delivered as records; stock movements, suppliers, and maintenance history planned |
| 5. Finance and reporting | Income and expense records | Records delivered; summaries, reports, and exports planned |
| 6. Verification | Automated tests, isolation and role tests | In progress; acceptance testing with users planned |

## 8. Next implementation backlog

1. Audit events for create, update, archive, membership, and finance actions.
2. Dashboard reminders: overdue tasks, health due, low stock, maintenance due.
3. Stock movements with balance calculated from movements and activity usage.
4. Harvest records and the expected versus actual yield report.
5. Breeding and birth records with offspring creation.
6. Farm linked documents shared with farm members.
7. Reports with filters and CSV export.
8. Ownership transfer and the System Administrator role.

