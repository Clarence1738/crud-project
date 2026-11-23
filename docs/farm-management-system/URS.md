# Farm Management System

## User Requirements Specification (URS)

**Status:** Draft for review  
**Version:** 0.2  
**Date:** 23 November 2026  
**Coverage:** Crop and livestock farm operations

## 1. Purpose and goal

Farm information is often split between notebooks, spreadsheets, receipts, and
individual staff knowledge. The Farm Management System will provide one portal
for recording and monitoring crop production, livestock, resources, work,
finances, and reports.

The goal is to improve record accuracy, operational visibility, planning, and
accountability while providing a structured foundation for future development.

## 2. Objectives

- Maintain accurate crop and livestock histories.
- Plan and monitor farm activities and production.
- Track feed, medicine, farm inputs, equipment, and stock.
- Assign work and monitor due or completed tasks.
- Track expenses, sales, and basic enterprise performance.
- Provide dashboards, reminders, reports, and exports.
- Protect farm information according to the user's role.
- Retain supporting documents with the relevant record.

## 3. Scope

Included modules are authentication, dashboard, farms and fields, crops,
livestock, feed and inventory, tasks and workers, equipment, finance, reports,
and private documents.

The first release excludes banking integrations, government registry
integrations, IoT sensors, GPS collars, drones, automated machinery,
e-commerce, payroll, tax filing, and automated disease diagnosis.

## 4. Users

| Role | Required access |
|---|---|
| Farm Owner | All farm operations, finance, reports, and settings |
| Farm Manager | Daily crop, livestock, inventory, task, and production records |
| Farm Worker | Assigned tasks and permitted activity updates |
| Administrator | Accounts, roles, configuration, and technical support |

The Farm Owner may manage multiple farms. Managers and Workers receive access
only to assigned farms. The Administrator is a technical role and does not
automatically receive access to private farm operations or finances.

## 5. User requirements

### Accounts and dashboard

- **URS-A01:** Users shall sign in and sign out securely.
- **URS-A02:** Functions and records shall be restricted by role and farm access.
- **URS-A03:** Important changes shall record the actor and time.
- **URS-D01:** The dashboard shall summarize crops, livestock, inventory, tasks,
  maintenance, and permitted financial information.
- **URS-D02:** The dashboard shall show due, overdue, health, breeding,
  low-stock, and maintenance reminders.
- **URS-D03:** Dashboard summaries shall open the related filtered records.

### Farms, fields, and crops

- **URS-C01:** Users shall maintain farm, field, and plot information.
- **URS-C01A:** A Farm Owner shall manage multiple farms under one account.
- **URS-C02:** Users shall create crop seasons with crop, variety, field, area,
  dates, expected yield, responsible person, and status.
- **URS-C03:** Users shall record land preparation, planting, irrigation,
  fertilizer, spraying, scouting, weeding, and harvest activities.
- **URS-C04:** Activities shall support labor, cost, inventory usage, notes, and documents.
- **URS-C05:** Users shall record pests, disease, weather damage, losses, and corrective action.
- **URS-C06:** Harvest records shall contain date, quantity, grade, loss,
  destination, and storage location.
- **URS-C07:** The system shall compare expected and actual yield and retain a
  complete crop-season history.

### Livestock

- **URS-L01:** Users shall register individual animals and livestock groups.
- **URS-L02:** Records shall include species, breed, sex, identity, birth or
  age, source, location, status, and parentage when known.
- **URS-L03:** Users shall record weight and production measurements.
- **URS-L04:** Users shall record diagnosis, vaccination, treatment, medicine,
  withdrawal period, cost, next due date, and provider.
- **URS-L05:** Users shall record breeding, pregnancy checks, expected births,
  births, and offspring.
- **URS-L06:** Users shall record transfers, sales, deaths, and culling.
- **URS-L07:** The system shall display health and breeding reminders and a
  chronological animal or group history.

### Feed, inventory, tasks, and equipment

- **URS-I01:** Users shall maintain items, categories, units, locations,
  reorder levels, suppliers, and expiry dates.
- **URS-I02:** Users shall record receipts, issues, transfers, and adjustments.
- **URS-I03:** Crop and livestock activities shall be able to consume inventory.
- **URS-I04:** Stock shall not become negative without an authorized adjustment.
- **URS-I05:** Feed allocation shall be linked to an animal, group, or location.
- **URS-T01:** Managers shall create and assign tasks with priority and due dates.
- **URS-T02:** Workers shall view and complete permitted assigned tasks.
- **URS-T03:** The system shall identify due, overdue, completed, and cancelled tasks.
- **URS-E01:** Users shall maintain equipment and schedule or record maintenance.
- **URS-E02:** The dashboard shall show maintenance due or overdue.

### Finance, documents, and reports

- **URS-F01:** Authorized users shall record categorized farm expenses.
- **URS-F02:** Authorized users shall record crop, livestock, and other farm sales.
- **URS-F03:** Users shall view income, expenses, and gross margin by period
  and, where data permits, by crop season or livestock enterprise.
- **URS-M01:** Users shall upload and link private documents to relevant records.
- **URS-M02:** Only authorized users shall view, download, replace, or delete documents.
- **URS-R01:** Reports shall cover crop activity and harvest, livestock
  inventory and health, breeding, stock movement, tasks, maintenance, expenses,
  sales, and gross margin.
- **URS-R02:** Authorized users shall filter and export report data.

## 6. Quality requirements

- Authentication, authorization, backend validation, and private file storage.
- Responsive desktop and mobile layouts with keyboard focus and clear errors.
- Server-side pagination, filtering, and indexed database queries.
- Transactions for stock, financial, and related multi-record operations.
- Modular crop, livestock, inventory, task, finance, and document code.
- Backups of both database records and private documents before production use.

## 7. Acceptance and review decisions

The first release succeeds when users can register farm resources, complete crop
and livestock workflows, receive reminders, record production and finance,
produce the defined reports, and demonstrate that unauthorized access is denied.

Approved demonstration baseline:

1. One Farm Owner can manage multiple farms.
2. Demo crops: maize, beans, potatoes, and tomatoes.
3. Demo livestock: dairy cattle, goats, sheep, and poultry.
4. Cattle, goats, and sheep support individual and group tracking. Poultry
   defaults to flock tracking, with individual tracking available.
5. Currency: Kenyan Shillings (KES).
6. Metric measurements: kilograms, litres, tonnes, hectares, square metres,
   and kilometres where applicable.
7. Roles: Farm Owner, Farm Manager, Farm Worker, and System Administrator.
8. Mandatory reports: crop activity and yield; livestock inventory and health;
   breeding and expected births; feed and inventory balance; low stock; task
   status; maintenance due; and expense, sales, and gross-margin summaries.

