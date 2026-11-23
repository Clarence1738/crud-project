# Farm Management System

## Functional Specification (FS)

**Status:** Draft derived from URS v0.2  
**Version:** 0.2  
**Date:** 23 November 2026

## 1. Portal structure

Primary navigation: Dashboard, Crops, Livestock, Inventory, Tasks, Equipment,
Finance, Reports, Documents, and Settings.

Each feature will have an Angular module or route, typed API service, Laravel
requests and policies, business service, database models and migrations, and
automated tests.

## 2. Permissions

| Function | Owner | Manager | Worker | Administrator |
|---|---:|---:|---:|---:|
| Operational dashboard | Yes | Yes | Limited | Technical |
| Crop and livestock records | Yes | Yes | Assigned updates | No |
| Inventory and equipment | Yes | Yes | Assigned issues | No |
| Assign and complete tasks | Yes | Yes | Complete only | No |
| Finance and reports | Yes | Configurable | No | No |
| Users, roles, configuration | Yes | No | No | Yes |

Laravel policies will enforce permissions. Hidden frontend actions are not authorization.

One owner may manage multiple farms. Managers and Workers receive explicit farm
assignments. Every operational record belongs to one farm, and switching the
active farm changes dashboard, list, report, calendar, and document scope. Only
the Owner can use an All farms summary.

## 3. Main workflows

### Crops

Crop season states: Planned, Active, Harvesting, Completed, or Cancelled.

A crop season contains farm, field, crop, variety, area, dates, expected yield,
responsible person, status, notes, and documents. Activities include preparation,
planting, irrigation, fertilizer, spraying, scouting, weeding, and harvesting.
Completing an activity with input usage creates stock issues in the same database
transaction. Harvest totals and yield per area are calculated from harvest records.

Demo crops are maize, beans, potatoes, and tomatoes. Additional crops and
varieties remain configurable.

### Livestock

The system supports individual animals and groups. Records contain identity,
species, breed, sex, birth or age, parentage, source, location, and lifecycle
status. Health events record diagnosis, treatment, vaccination, medicine, dose,
withdrawal date, cost, provider, and next due date.

Breeding records contain female, date, method, optional sire, pregnancy result,
expected birth, and outcome. A birth can create linked offspring records.
Inactive animals cannot receive future operational events.

Demo livestock are dairy cattle, goats, sheep, and poultry. Cattle, goats, and
sheep support individual and group records. Poultry defaults to flock tracking.

### Inventory and feed

Stock is calculated from receipt, issue, transfer, and adjustment movements.
Every movement records item, quantity, unit, location, date, actor, source, and
optional unit cost. Issues cannot exceed available stock without authorized
adjustment. Feed issues link to an animal, group, or livestock location.

### Tasks and equipment

Task states are Open, In progress, Completed, or Cancelled. Overdue is calculated
from due date and incomplete status. Tasks contain category, location, priority,
assignee, instructions, dates, related record, and completion notes.

Equipment records contain identity, type, location, status, acquisition data,
service interval, and next service date. Maintenance records contain work,
provider, cost, parts, downtime, and next service date.

### Finance and documents

Expenses record date, category, amount, currency, supplier, payment reference,
description, and related farm activity. Sales record buyer, product, source,
quantity, unit price, total, payment status, and date. Gross margin is recorded
income minus recorded direct expenses and is not described as audited profit.

Files are stored privately with random server names. Metadata retains title,
original name, type, size, owner, link, and timestamps. Download and mutation
require authorization.

## 4. Dashboard and reports

Dashboard cards show active crop seasons, activities due, active livestock,
health and breeding reminders, overdue tasks, low stock, maintenance due, and
permitted financial totals. Selecting a card opens its filtered list.

Reports include:

- Crop activity, input cost, expected-versus-actual yield, harvest, and loss.
- Livestock inventory, health, breeding, birth, mortality, and production.
- Feed and inventory balance, movements, low stock, and expiring stock.
- Task completion, overdue work, maintenance, expenses, sales, and gross margin.

Exports use the same farm scope, permissions, and filters as the screen.

Mandatory demo reports are crop activity and yield, livestock inventory and
health due, breeding and expected births, feed and inventory balance, low
stock, task status, maintenance due, expenses, sales, and gross margin.

## 5. Validation and audit behavior

- ISO date values; end dates cannot precede start dates.
- Quantities and monetary values cannot be negative.
- Related records must belong to the same authorized farm.
- Farm identifiers configured as unique cannot be duplicated.
- Archived or closed records reject new activity unless reopened.
- Backend validation is authoritative.
- Monetary values use Kenyan Shillings (KES).
- Standard measurements use kilograms, litres, tonnes, hectares, square
  metres, and kilometres with explicit conversions.
- Important create, update, archive, stock, health, and finance actions record
  actor and timestamp.
- Guests receive 401; hidden cross-farm records return 404; invalid changes
  return field feedback.

## 6. Data model

Core entities are User, Role, Farm, Field, Crop, CropVariety, CropSeason,
CropActivity, Harvest, Animal, LivestockGroup, HealthEvent, BreedingEvent,
BirthEvent, Measurement, InventoryItem, StockLocation, StockMovement, Supplier,
Task, WorkerProfile, Equipment, MaintenanceRecord, Expense, Sale, Document, and
AuditEvent.

FarmMembership and FarmRoleAssignment connect users to permitted farms. All
operational entities contain a farm identifier for query and policy scoping.

Operational entities contain farm scope, timestamps, and a lifecycle or archive
state where retention is required.

## 7. Acceptance scenarios

1. Create a crop season, consume planting inputs, record activities and harvest,
   and view expected versus actual yield.
2. Register an animal, record vaccination and breeding, create offspring at
   birth, and view the complete history.
3. Link a stock issue to an activity and verify the balance changes once.
4. Assign and complete a task and verify overdue dashboard counts update.
5. Prevent one farm user from opening another farm's records or files.
6. Produce filtered reports using only the authorized farm's information.

## 8. Development sequence

1. Approve URS v0.2 and FS v0.2 as the demonstration baseline.
2. Create wireframes and the entity relationship diagram.
3. Build authentication, farm scope, permissions, and audit support.
4. Implement crop and livestock modules.
5. Implement inventory, feed, tasks, and equipment.
6. Implement finance, documents, dashboard, and reports.
7. Complete automated and user-acceptance testing.

