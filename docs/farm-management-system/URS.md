# Farm Management System

## User Requirements Specification (URS)

| Document control | |
|---|---|
| Document ID | FMS-URS |
| Version | 1.0 |
| Date | 25 November 2026 |
| Status | Issued for review |
| Coverage | Crop and livestock farm operations, farm resources, finance, documents, and reporting |
| Related documents | FMS-FS v1.0 Functional Specification; FMS-DES v1.0 System Design; FMS-DEC v1.0 Decision Log |

## 1. Introduction

### 1.1 Purpose

This document states what the users and owners of the Farm Management System
need from it. It is the agreed basis for the Functional Specification
(FMS-FS), the System Design (FMS-DES), development of the farm portal, and
acceptance testing.

### 1.2 Conventions

- Each requirement has a unique identifier: URS-, then an area letter, then a
  number. Identifiers are never reused.
- **Priority** follows the MoSCoW method for the first production release:
  **Must** (release cannot be accepted without it), **Should** (important, may
  follow shortly after release), **Could** (desirable if time allows).
- "Shall" states a mandatory requirement. "The user" means a signed in user
  acting within their farm role.
- Implementation status is not recorded here. FMS-FS section 13 traces each
  requirement to its use cases and current status.

## 2. Business context

### 2.1 Problem statement

Farm information is often split between notebooks, spreadsheets, receipts, and
individual staff knowledge. Owners cannot easily see what has been planted,
which animals need treatment, what stock remains, which tasks are overdue, or
whether an enterprise is making money. Records are lost when staff change, and
there is no reliable history for planning, lending, or certification.

### 2.2 Business goals

| ID | Goal |
|---|---|
| G-1 | Keep accurate, complete crop and livestock histories in one place. |
| G-2 | Give owners and managers current visibility of operations across several farms. |
| G-3 | Reduce missed treatments, missed maintenance, stockouts, and overdue work. |
| G-4 | Show income, expenses, and gross margin by period and enterprise. |
| G-5 | Protect each farm's information so that people see only what their role allows. |

### 2.3 Success measures

| Measure | Target within three months of go live |
|---|---|
| Crop seasons, livestock, and health events recorded in the portal rather than on paper | 90 percent |
| Health treatments and equipment services completed by their due date | 90 percent |
| Time to prepare the monthly expense, sales, and gross margin summary | Under 10 minutes |
| Unauthorized access incidents to another farm's records | Zero |

## 3. Scope

### 3.1 In scope

Authentication and farm access; dashboard; farms, fields, and plots; crop
seasons, activities, harvests, and losses; livestock, health, breeding, and
production; feed and inventory; tasks and workers; equipment and maintenance;
expenses and sales; private documents; reports and exports.

### 3.2 Out of scope for the first release

Banking and mobile money integrations; government registry integrations; IoT
sensors, GPS collars, drones, and automated machinery; ecommerce; payroll; tax
filing; automated disease diagnosis; offline mobile application.

## 4. Stakeholders and users

| Role | Description | Typical tasks | Access required |
|---|---|---|---|
| Farm Owner | Owns one or more farms and is accountable for them | Reviews performance, approves spending, manages people | All operations, finance, reports, members, and settings for owned farms |
| Farm Manager | Runs daily operations on assigned farms | Plans seasons, records activities, manages stock, assigns tasks | Operational records and reports; finance only if granted by the Owner |
| Farm Worker | Carries out field and animal work | Completes assigned tasks, records activities and treatments | Assigned tasks and permitted activity records on assigned farms |
| System Administrator | Provides technical support | Manages accounts and configuration | Accounts and configuration; no automatic access to farm operations or finance |

One Owner may manage multiple farms. Managers and Workers have access only to
farms to which they are invited.

## 5. Definitions

| Term | Meaning |
|---|---|
| Farm | A registered farm business unit with a county, location, and size in hectares. |
| Active farm | The single farm on which the user is currently working in the portal. |
| Membership | The link between a user and a farm, carrying exactly one role. |
| Field | A defined land unit or plot within a farm. |
| Crop season | One planting of a crop variety on a field, from planning to completion. |
| Livestock record | An individual animal identified by tag, or a group or flock with a quantity. |
| Archive | Hiding a record from active lists and totals while retaining its history. |
| Gross margin | Recorded income minus recorded direct expenses; not audited profit. |
| KES | Kenyan Shillings, the currency for all monetary values. |

## 6. Assumptions and constraints

### 6.1 Assumptions

- Users have a smartphone, tablet, or computer with a current web browser and
  an internet connection while recording.
- Each person has their own email address and account; accounts are not shared.
- Farm sizes and field sizes are known in hectares to two decimal places.
- Demonstration data covers maize, beans, potatoes, and tomatoes; dairy cattle,
  goats, sheep, and poultry.

### 6.2 Constraints

- The solution uses Angular, Laravel, and PostgreSQL as established in the
  project, hosted on a single HTTPS origin.
- All monetary values are in KES. Measurements are metric.
- Private documents must be stored outside the public web root.
- Personal data must be handled in line with the Kenya Data Protection Act, 2019.

## 7. Functional requirements

### 7.1 Accounts, access, and records

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| URS-A01 | Users shall sign in and sign out securely. | Must | A user registers and signs in with email and password; signing out ends the session; a signed out user cannot open any farm page or record. |
| URS-A02 | Functions and records shall be restricted by role and farm access. | Must | A user cannot open any record of a farm they do not belong to; each role can perform only the actions in the FMS-FS permission matrix, and other actions are refused. |
| URS-A03 | Important changes shall record the actor and time. | Must | Creating, editing, archiving, stock, health, finance, and membership changes are listed in an audit history showing who acted, what changed, and when. |
| URS-A04 | A Farm Owner shall invite people to a farm, assign their role, and remove access. | Must | The Owner invites a person as Manager or Worker, changes the role, and removes the person; a removed person immediately loses access. |
| URS-A05 | Records shall be archived rather than permanently deleted, and archived records shall be restorable. | Must | An archived record disappears from active lists and totals, appears in an archive view, and can be restored with its history intact. |

### 7.2 Dashboard

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| URS-D01 | The dashboard shall summarize crops, livestock, inventory, tasks, maintenance, and permitted financial information. | Must | For the active farm, the dashboard shows active crop seasons, land use, livestock by species, low stock items, open and overdue tasks, maintenance due, and (for permitted roles) income and expenses for the current month. |
| URS-D02 | The dashboard shall show due, overdue, health, breeding, low stock, and maintenance reminders. | Should | Items falling due within 7 days and overdue items appear as reminders, each with its due date. |
| URS-D03 | Dashboard summaries shall open the related filtered records. | Should | Selecting a dashboard figure opens the matching list already filtered to the records counted. |

### 7.3 Farms, fields, and crops

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| URS-C01 | Users shall maintain farm, field, and plot information. | Must | A farm records name, county, location, and size; fields record name, size, soil type, and status; field names are unique within a farm. |
| URS-C01A | A Farm Owner shall manage multiple farms under one account. | Must | An Owner creates two or more farms and switches between them; each farm's records stay separate. |
| URS-C02 | Users shall create crop seasons with crop, variety, field, area, dates, expected yield, responsible person, and status. | Must | A season cannot use more area than its field; the expected harvest date cannot precede planting; the responsible person is a farm member. |
| URS-C03 | Users shall record land preparation, planting, irrigation, fertilizer, spraying, scouting, weeding, and harvest activities. | Must | Each listed activity type can be recorded against an open crop season with its date. |
| URS-C04 | Activities shall support labour, cost, inventory usage, notes, and documents. | Should | An activity records labour (persons and hours), cost in KES, items used with quantities, notes, and attached files. |
| URS-C05 | Users shall record pests, disease, weather damage, losses, and corrective action. | Should | A loss or incident records type, date, affected area or quantity, description, and corrective action. |
| URS-C06 | Harvest records shall contain date, quantity, grade, loss, destination, and storage location. | Must | Several harvests can be recorded per season; the season's harvested total equals the sum of its harvest records. |
| URS-C07 | The system shall compare expected and actual yield and retain a complete crop season history. | Must | Each season shows expected yield, actual yield, yield per hectare, and its activities, harvests, and losses in date order. |

### 7.4 Livestock

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| URS-L01 | Users shall register individual animals and livestock groups. | Must | Individual animals have a tag unique within the farm; groups have a name and quantity; poultry defaults to group tracking. |
| URS-L02 | Records shall include species, breed, sex, identity, birth or age, source, location, status, and parentage when known. | Must | All listed attributes can be recorded; dam and sire, where recorded, are animals of the same farm. |
| URS-L03 | Users shall record weight and production measurements. | Could | Weight, milk, and egg measurements are recorded with date, value, and unit, and shown as a history. |
| URS-L04 | Users shall record diagnosis, vaccination, treatment, medicine, withdrawal period, cost, next due date, and provider. | Must | A health event records all listed attributes; the withdrawal end date is shown while it is in force. |
| URS-L05 | Users shall record breeding, pregnancy checks, expected births, births, and offspring. | Should | A breeding record produces an expected birth date; recording a birth can create linked offspring records. |
| URS-L06 | Users shall record transfers, sales, deaths, and culling. | Must | Each exit records its date and reason; the animal becomes inactive and accepts no further events. |
| URS-L07 | The system shall display health and breeding reminders and a chronological animal or group history. | Should | Reminders appear 7 days before due; each animal or group shows its full event history in date order. |

### 7.5 Feed, inventory, tasks, and equipment

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| URS-I01 | Users shall maintain items, categories, units, locations, reorder levels, suppliers, and expiry dates. | Must | All listed attributes can be recorded; item names are unique within a farm. |
| URS-I02 | Users shall record receipts, issues, transfers, and adjustments. | Must | The balance shown equals opening stock plus receipts minus issues, plus or minus adjustments, for each item and location. |
| URS-I03 | Crop and livestock activities shall be able to consume inventory. | Should | Recording an activity with items used creates the stock issues in the same save, and the balance changes once. |
| URS-I04 | Stock shall not become negative without an authorized adjustment. | Must | An issue larger than the available balance is refused unless an Owner or Manager records an adjustment. |
| URS-I05 | Feed allocation shall be linked to an animal, group, or location. | Should | Each feed issue names the animal, group, or livestock location fed. |
| URS-T01 | Managers shall create and assign tasks with priority and due dates. | Must | A task records title, assignee from the farm's members, priority, due date, status, and instructions. |
| URS-T02 | Workers shall view and complete permitted assigned tasks. | Must | A Worker can change the status of tasks assigned to them and of no others. |
| URS-T03 | The system shall identify due, overdue, completed, and cancelled tasks. | Must | A task not Completed or Cancelled after its due date is shown as overdue without manual action. |
| URS-E01 | Users shall maintain equipment and schedule or record maintenance. | Must | Equipment records identity, type, status, and service interval; each maintenance record sets the next service date. |
| URS-E02 | The dashboard shall show maintenance due or overdue. | Should | Equipment whose next service date is within 7 days or past appears on the dashboard. |

### 7.6 Finance, documents, and reports

| ID | Requirement | Priority | Acceptance criteria |
|---|---|---|---|
| URS-F01 | Authorized users shall record categorized farm expenses. | Must | An expense records date, category, amount in KES, supplier, payment reference, and description, and may link to a crop season or livestock group. |
| URS-F02 | Authorized users shall record crop, livestock, and other farm sales. | Must | A sale records buyer, product, source, quantity, unit price, total, payment status, and date; total equals quantity times unit price. |
| URS-F03 | Users shall view income, expenses, and gross margin by period and, where data permits, by crop season or livestock enterprise. | Must | For a chosen period the summary shows income, expenses, and gross margin, matching the sum of the underlying records. |
| URS-M01 | Users shall upload and link private documents to relevant records. | Must | PDF, image, text, and CSV files up to 10 MB can be attached to a farm record and opened from it. |
| URS-M02 | Only authorized users shall view, download, replace, or delete documents. | Must | A user without access to the linked farm record cannot list, open, or download its files. |
| URS-R01 | Reports shall cover crop activity and harvest, livestock inventory and health, breeding, stock movement, tasks, maintenance, expenses, sales, and gross margin. | Must | Each mandatory report in section 9 is available to the permitted roles. |
| URS-R02 | Authorized users shall filter and export report data. | Must | Reports filter by farm, period, and the report's own filters; the CSV export contains exactly the rows shown. |

## 8. Nonfunctional requirements

| ID | Area | Requirement and measure | Priority |
|---|---|---|---|
| URS-Q01 | Security | Passwords have at least 12 characters with upper and lower case, numbers, and symbols, and are stored only as salted hashes. Sign in is limited to 5 attempts per minute per account and address. Sessions expire after 120 minutes of inactivity. All traffic uses HTTPS in production. | Must |
| URS-Q02 | Authorization | Every request is checked on the server for farm membership and role. Records of another farm are indistinguishable from records that do not exist. | Must |
| URS-Q03 | Privacy | Personal data is limited to name, email, and farm role. Private files are stored outside the public web root under random names. | Must |
| URS-Q04 | Performance | With 5,000 records per farm module, list pages and the dashboard respond within 2 seconds for 95 percent of requests on a typical broadband connection. | Must |
| URS-Q05 | Usability | Every screen works from 360 pixels wide (mobile) to desktop, supports keyboard use with visible focus, and shows a clear message for every validation error. Target: WCAG 2.1 level AA. | Must |
| URS-Q06 | Compatibility | Current versions of Chrome, Edge, Firefox, and Safari on desktop and Android or iOS. | Must |
| URS-Q07 | Data integrity | Stock, finance, membership, and multirecord operations complete fully or not at all. Quantities and amounts cannot be negative. | Must |
| URS-Q08 | Availability | 99 percent monthly availability during production, excluding announced maintenance. | Should |
| URS-Q09 | Backup and recovery | Daily backup of the database and private files taken together; recovery point no older than 24 hours; recovery within 8 hours; restore tested before go live. | Must |
| URS-Q10 | Maintainability | Code is organized by module; automated tests cover access control and every Must requirement implemented. | Must |
| URS-Q11 | Localization | Dates shown as DD Mon YYYY and stored in ISO format; business dates use the Africa/Nairobi time zone; currency shown as KES. | Must |

## 9. Reporting requirements

| No. | Report | Purpose | Permitted roles |
|---|---|---|---|
| R1 | Crop activity and yield | Activities, input cost, harvests, losses, and expected versus actual yield per season | Owner, Manager |
| R2 | Livestock inventory and health due | Animals and groups by species and status; health events due and overdue | Owner, Manager |
| R3 | Breeding and expected births | Breeding records, pregnancy results, and births expected in the period | Owner, Manager |
| R4 | Feed and inventory balance | Balance and movements per item, low stock, and items expiring within 30 days | Owner, Manager |
| R5 | Task status | Tasks due, overdue, completed, and cancelled by assignee | Owner, Manager |
| R6 | Maintenance due | Equipment service due and overdue, with recent maintenance cost | Owner, Manager |
| R7 | Expenses, sales, and gross margin | Income, expenses, and gross margin by period, category, and enterprise | Owner (Manager if granted) |

Detailed filters, columns, and calculations are specified in FMS-FS section 8.

## 10. Acceptance approach

1. Each requirement is verified against its acceptance criteria by the test
   cases in FMS-FS section 14.
2. User acceptance testing is carried out with at least one Owner, one Manager,
   and one Worker using the demonstration data.
3. The release is accepted when all Must requirements pass, no defect blocks a
   Must requirement, and any open Should requirements have an agreed delivery
   date.
4. Security acceptance includes a test that each role is refused every action
   outside its permissions and that no farm's data is visible to another farm's
   users.

Approved demonstration baseline: one Owner manages multiple farms; demo crops
maize, beans, potatoes, and tomatoes; demo livestock dairy cattle, goats, sheep,
and poultry; individual and group tracking with poultry defaulting to flocks;
KES currency; metric units; roles Owner, Manager, Worker, and System
Administrator; and the seven mandatory reports in section 9.

