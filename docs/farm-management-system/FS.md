# Farm Management System

## Functional Specification (FS)

| Document control | |
|---|---|
| Document ID | FMS-FS |
| Version | 1.0 |
| Date | 25 November 2026 |
| Status | Issued for review |
| Baseline | FMS-URS v1.0 |
| Related documents | FMS-DES v1.0 System Design; FMS-DEC v1.0 Decision Log |

## 1. Introduction

### 1.1 Purpose

This specification defines how the Farm Management System portal meets each
requirement in FMS-URS v1.0. It describes who does what (use cases), how records
move through their life (process flows), what each screen contains, the rules
the system enforces, and how reports are calculated. It is the reference for
building, testing, and accepting the portal.

### 1.2 Status of functions

Each use case and requirement carries one status:

| Status | Meaning |
|---|---|
| Implemented | Available in the current portal and covered by automated tests. |
| Partial | Some elements are available; the remaining elements are listed and specified here. |
| Planned | Fully specified here and scheduled for development; not yet available. |

Where this document and the implemented portal differ for an Implemented
function, the difference is a defect and must be recorded.

### 1.3 References

FMS-URS v1.0 User Requirements Specification; FMS-DES v1.0 System Design;
FMS-DEC v1.0 Decision Log; project README.

## 2. System overview

### 2.1 Context

Farm Owners, Managers, and Workers use a web portal in their browser. The portal
calls a secured application programming interface (API), which stores records
in a PostgreSQL database and private files in protected storage. Every request
is checked for a signed in session, farm membership, and role.

```flow
Users: Owner, Manager, Worker > Web portal (browser) > Secured API > Database and private file storage
```

### 2.2 Portal structure

| Area | Screens | Status |
|---|---|---|
| Overview | Dashboard | Partial |
| Farm setup | Farms, members and invitations, Fields | Implemented |
| Crops | Crop seasons, Crop activities, Harvests, Losses | Partial |
| Livestock | Livestock, Animal health, Breeding, Measurements | Partial |
| Resources | Inventory, Stock movements, Tasks, Equipment, Maintenance | Partial |
| Finance | Expenses and sales, Finance summary | Partial |
| Information | Reports, Documents, Audit history | Planned (Documents partial) |

### 2.3 Active farm

- Every farm screen works on one active farm chosen from the farm picker.
- The choice is remembered in the browser and restored after a reload, but only
  if the user is still a member of that farm; otherwise the first farm is used.
- The choice is cleared on sign out. It grants no access by itself.

## 3. Roles and permissions

| Function | Owner | Manager | Worker |
|---|:-:|:-:|:-:|
| View dashboard and operational records | Yes | Yes | Yes |
| Record crop activities and animal health events | Yes | Yes | Yes |
| Edit crop activities and animal health events | Yes | Yes | No |
| Add, edit, archive crops, livestock, fields, inventory, equipment, tasks | Yes | Yes | No |
| Record stock movements (planned) | Yes | Yes | Issues only |
| Change the status of tasks assigned to them | Yes | Yes | Yes |
| Change the status of any task | Yes | Yes | No |
| View and record finance | Yes | If granted (planned) | No |
| View reports (planned) | Yes | Yes, finance if granted | No |
| Edit farm details; invite, change roles, remove members | Yes | No | No |
| View audit history (planned) | Yes | No | No |
| Leave the farm | No | Yes | Yes |

Rules:

- The server enforces every permission. Hiding a button is a convenience only.
- A nonmember receives "not found" for a farm's records, so other farms are not
  disclosed. A member without the permission receives "not permitted" with a
  message.
- Each farm has exactly one Owner, its creator. Ownership transfer is planned.
- Manager finance access is currently Owner only (decision D-10); a per farm
  grant is planned.
- The System Administrator role is planned and has no automatic farm access.

## 4. Use cases

### 4.1 Use case index

| ID | Use case | Primary actor | Requirements | Status |
|---|---|---|---|---|
| UC-01 | Register and sign in | Any user | URS-A01 | Implemented |
| UC-02 | Create and edit a farm | Owner | URS-C01, URS-C01A | Implemented |
| UC-03 | Select the active farm | Any member | URS-A02 | Implemented |
| UC-04 | Invite a person to a farm | Owner | URS-A04 | Implemented |
| UC-05 | Join a farm with an invitation code | Invitee | URS-A04 | Implemented |
| UC-06 | Manage members | Owner, member | URS-A04 | Implemented |
| UC-07 | Maintain fields | Owner, Manager | URS-C01 | Implemented |
| UC-08 | Plan and manage a crop season | Owner, Manager | URS-C02, URS-A05 | Partial |
| UC-09 | Record a crop activity | Any member | URS-C03, URS-C04, URS-I03 | Partial |
| UC-10 | Record a harvest | Owner, Manager | URS-C06, URS-C07 | Planned |
| UC-11 | Record a crop loss or incident | Owner, Manager | URS-C05 | Planned |
| UC-12 | Register livestock | Owner, Manager | URS-L01, URS-L02 | Partial |
| UC-13 | Record an animal health event | Any member | URS-L04 | Partial |
| UC-14 | Record breeding and births | Owner, Manager | URS-L05 | Planned |
| UC-15 | Record a livestock exit | Owner, Manager | URS-L06 | Partial |
| UC-16 | Record a stock movement | Owner, Manager, Worker | URS-I01, URS-I02, URS-I04, URS-I05 | Planned |
| UC-17 | Create and assign a task | Owner, Manager | URS-T01 | Implemented |
| UC-18 | Complete an assigned task | Worker | URS-T02, URS-T03 | Partial |
| UC-19 | Maintain equipment and record maintenance | Owner, Manager | URS-E01 | Partial |
| UC-20 | Record an expense or sale | Owner | URS-F01, URS-F02 | Partial |
| UC-21 | View the dashboard | Any member | URS-D01, URS-D02, URS-D03 | Partial |
| UC-22 | Run and export a report | Owner, Manager | URS-R01, URS-R02, URS-F03 | Planned |
| UC-23 | Attach and manage documents | Any member | URS-M01, URS-M02 | Partial |
| UC-24 | Archive and restore a record | Owner, Manager | URS-A05 | Partial |

### 4.2 Use case specifications

#### UC-01 Register and sign in

| Item | Detail |
|---|---|
| Actors | Any person with an email address |
| Preconditions | None for registration; an account for sign in |
| Main flow | 1. The person opens the portal and chooses to create an account.<br>2. They enter name, email, password, and confirmation.<br>3. The system validates the password rules and creates the account.<br>4. The system signs the person in and opens the Dashboard. |
| Alternative flows | 2a. Email already registered: the system refuses and asks the person to sign in.<br>3a. Password too weak: the system lists the rule not met.<br>Sign in: the person enters email and password; after 5 failed attempts in a minute further attempts are refused for a minute. |
| Postconditions | A new session exists. Signing out ends it and clears the active farm. |
| Status | Implemented |

#### UC-02 Create and edit a farm

| Item | Detail |
|---|---|
| Actors | Any signed in user (becomes Owner); Owner for edits |
| Main flow | 1. The user selects Add farm.<br>2. They enter name, county, location, size in hectares, and notes.<br>3. The system creates the farm and an Owner membership for the user in one step.<br>4. The new farm becomes the active farm. |
| Alternative flows | Edit: the Owner selects Edit details on the farm card and saves changes. Managers and Workers do not see the action and are refused by the server. |
| Postconditions | The farm appears in the user's farm list with role Owner. |
| Status | Implemented |

#### UC-03 Select the active farm

| Item | Detail |
|---|---|
| Actors | Any member of two or more farms |
| Main flow | 1. The user chooses a farm in the Active farm picker on any farm screen.<br>2. The system loads that farm's records and remembers the choice in the browser.<br>3. After a reload the same farm is selected. |
| Alternative flows | 3a. The user is no longer a member of the remembered farm: the first available farm is selected and the stale choice is discarded. |
| Postconditions | All screens show the chosen farm until another is chosen or the user signs out. |
| Status | Implemented |

#### UC-04 Invite a person to a farm

| Item | Detail |
|---|---|
| Actors | Owner |
| Preconditions | The Owner is on the Farms screen with the farm active |
| Main flow | 1. The Owner enters the person's email and selects Manager or Worker.<br>2. The system creates the invitation and shows a one time code.<br>3. The Owner copies the code and sends it to the person by their own means.<br>4. The invitation appears under Pending invitations with its expiry date. |
| Alternative flows | 1a. The person is already a member: the system refuses.<br>1b. A pending invitation exists for the same email: the new one replaces it.<br>Revoke: the Owner selects Revoke; the code stops working. |
| Postconditions | A pending invitation valid for 7 days. Only a hash of the code is stored. |
| Status | Implemented |

#### UC-05 Join a farm with an invitation code

| Item | Detail |
|---|---|
| Actors | Invitee |
| Preconditions | The invitee has an account with the invited email and is signed in |
| Main flow | 1. The invitee enters the code under Join another farm, or on the empty screen if they have no farms.<br>2. The system checks the code, expiry, and that the signed in email matches.<br>3. The system creates the membership with the invited role and marks the invitation used.<br>4. The joined farm becomes the active farm. |
| Alternative flows | 2a. Code unknown, expired, revoked, already used, or for another email: the system refuses with one general message. |
| Postconditions | The invitee is a member with the invited role. |
| Status | Implemented |

#### UC-06 Manage members

| Item | Detail |
|---|---|
| Actors | Owner; any nonowner member for leaving |
| Main flow | 1. The Owner opens the member list on the Farms screen.<br>2. The Owner changes a member between Manager and Worker, or selects Remove and confirms.<br>3. The system applies the change at once. |
| Alternative flows | Leave: a Manager or Worker selects Leave farm and confirms; the farm disappears from their list.<br>The Owner's own role cannot be changed or removed. |
| Postconditions | Tasks assigned to a removed member become unassigned. |
| Status | Implemented |

#### UC-07 Maintain fields

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user opens Fields and selects Add field.<br>2. They enter name, size in hectares, soil type, status (Available, In use, Resting), and notes.<br>3. The system checks the name is unique on the farm and saves the field. |
| Alternative flows | Edit: the user selects Edit, changes values, and saves. Workers can view fields only. |
| Postconditions | The field is available when planning crop seasons. |
| Status | Implemented |

#### UC-08 Plan and manage a crop season

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Preconditions | The farm has at least one field |
| Main flow | 1. The user selects Add crop season.<br>2. They choose crop, variety, field, area, planting and expected harvest dates, status, expected yield, responsible person, and notes.<br>3. The system checks the field belongs to the farm and the area does not exceed the field size.<br>4. The season appears in the list and the dashboard land use updates.<br>5. Over time the user edits the season to move it through its states (section 5.1). |
| Alternative flows | 3a. Area exceeds field size or harvest date precedes planting: the system refuses with the reason.<br>Archive and restore: see UC-24. |
| Postconditions | The season exists with its history. |
| Status | Partial. Responsible person is planned. |

#### UC-09 Record a crop activity

| Item | Detail |
|---|---|
| Actors | Owner, Manager, Worker |
| Preconditions | An open crop season (not archived, Completed, or Cancelled) |
| Main flow | 1. The user opens Crop activities and selects Add activity.<br>2. They choose the crop season, activity type, date, cost, and notes.<br>3. Planned: they add labour (persons, hours) and items used with quantities, and attach files.<br>4. The system saves the activity; planned: it issues the items from stock in the same save. |
| Alternative flows | 2a. No open season: the Add button is disabled with an explanation.<br>4a. Planned: insufficient stock for an item: the whole save is refused. |
| Postconditions | The activity appears in the season history. |
| Status | Partial. Labour, inventory usage, and attachments are planned. |

#### UC-10 Record a harvest

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Preconditions | A season in Active or Harvesting state |
| Main flow | 1. The user opens the season and selects Add harvest.<br>2. They enter date, quantity (kg), grade, loss (kg), destination, and storage location.<br>3. The system saves the harvest and recalculates the season's harvested total and yield per hectare. |
| Alternative flows | Several harvests may be recorded. Completing the season prevents further harvests unless reopened. |
| Postconditions | Harvested total equals the sum of harvest records. |
| Status | Planned. A single harvested quantity per season is available now. |

#### UC-11 Record a crop loss or incident

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user opens the season and selects Add incident.<br>2. They enter type (pest, disease, weather, theft, other), date, affected area or quantity, description, and corrective action.<br>3. The system saves the incident in the season history and includes it in report R1. |
| Status | Planned |

#### UC-12 Register livestock

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user selects Add livestock and chooses Individual or Group.<br>2. Individual: tag number (unique on the farm); Group: group or flock name and quantity.<br>3. They enter species, breed, sex, birth date, status, location, notes; planned: source, dam, and sire.<br>4. The system saves the record and updates dashboard livestock totals. |
| Alternative flows | 2a. Tag already used on the farm: the system refuses.<br>Poultry defaults to group tracking. |
| Status | Partial. Source and parentage are planned. |

#### UC-13 Record an animal health event

| Item | Detail |
|---|---|
| Actors | Owner, Manager, Worker |
| Preconditions | An active, unarchived animal or group |
| Main flow | 1. The user opens Animal health and selects Add health event.<br>2. They choose the animal or group, event type, date, medicine, cost, next due date, and notes; planned: diagnosis, dose, withdrawal days, provider.<br>3. The system saves the event; planned: it shows a reminder 7 days before the next due date and flags the withdrawal period. |
| Alternative flows | 2a. Next due date before the event date: refused. Inactive or archived animal: not offered and refused by the server. |
| Status | Partial. Diagnosis, dose, withdrawal, provider, and reminders are planned. |

#### UC-14 Record breeding and births

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user records a breeding: female, date, method (natural or artificial insemination), and optional sire.<br>2. The system calculates the expected birth date from the species gestation period.<br>3. The user records pregnancy check results.<br>4. At birth the user records date, number born alive and dead, and may create offspring records linked to dam and sire. |
| Postconditions | Expected births appear in report R3 and as dashboard reminders. |
| Status | Planned |

#### UC-15 Record a livestock exit

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user edits the record and sets status to Sold, Transferred, Deceased, or Culled.<br>2. Planned: they enter the exit date, reason, and for sales the buyer and price, which also creates a sale record.<br>3. The animal becomes inactive and accepts no further health events. |
| Status | Partial. Status change is available; exit details and linked sale are planned. |

#### UC-16 Record a stock movement

| Item | Detail |
|---|---|
| Actors | Owner, Manager (all movements); Worker (issues only) |
| Main flow | 1. The user opens an item and selects Receive, Issue, Transfer, or Adjust.<br>2. They enter quantity, date, location, unit cost (receipts), supplier (receipts), and for feed issues the animal, group, or location fed.<br>3. The system checks the available balance for issues and transfers.<br>4. The system records the movement and recalculates the balance. |
| Alternative flows | 3a. Quantity exceeds balance: refused, unless an Owner or Manager records an adjustment with a reason. |
| Status | Planned. Items with a directly edited quantity are available now. |

#### UC-17 Create and assign a task

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user selects Add task.<br>2. They enter title, assignee (from farm members, or unassigned), priority, due date, status, and instructions.<br>3. The system checks the assignee is a member of the farm and saves the task. |
| Status | Implemented |

#### UC-18 Complete an assigned task

| Item | Detail |
|---|---|
| Actors | Worker (assignee) |
| Main flow | 1. The Worker opens Tasks and selects Update status on a task assigned to them.<br>2. They choose In progress, Completed, or Cancelled and save.<br>3. The system checks the task is assigned to them and saves the status. |
| Alternative flows | Tasks of other people show no action and are refused by the server. |
| Status | Partial. Overdue identification on screen and dashboard is planned. |

#### UC-19 Maintain equipment and record maintenance

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user records equipment: name, category, status, service interval, next service date.<br>2. Planned: after a service they add a maintenance record: date, work done, provider, cost, parts, downtime.<br>3. Planned: the system sets the next service date from the interval. |
| Status | Partial. Equipment with next service date and cost is available; maintenance history is planned. |

#### UC-20 Record an expense or sale

| Item | Detail |
|---|---|
| Actors | Owner (Manager if granted, planned) |
| Main flow | 1. The user opens Finance and selects Add transaction.<br>2. Expense: date, category, amount, supplier, payment reference, description, optional link to a season or livestock group.<br>3. Sale: date, buyer, product, source, quantity, unit price, payment status; the system calculates the total.<br>4. The system saves the record. |
| Status | Partial. Income and expense with category, date, amount, party, and notes are available; sale details, payment reference, and enterprise links are planned. |

#### UC-21 View the dashboard

| Item | Detail |
|---|---|
| Actors | Any member |
| Main flow | 1. The user signs in or selects Dashboard.<br>2. The system shows the cards in section 9 for the active farm, excluding archived records and finance for roles without finance access.<br>3. Planned: the user selects a card to open the filtered list. |
| Status | Partial. Crop, livestock, and land cards are available. |

#### UC-22 Run and export a report

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user opens Reports and chooses a report.<br>2. They set the period and report filters.<br>3. The system shows the report for the active farm only.<br>4. The user selects Export CSV; the file contains exactly the rows shown. |
| Status | Planned |

#### UC-23 Attach and manage documents

| Item | Detail |
|---|---|
| Actors | Any member with access to the record |
| Main flow | 1. The user opens a record and selects Attach file.<br>2. They choose a PDF, image, text, or CSV file up to 10 MB and a title.<br>3. The system stores the file privately and lists it on the record.<br>4. Permitted users can download, rename, replace, or delete it. |
| Status | Partial. Account private documents are available; attaching to farm records and sharing with farm members are planned. |

#### UC-24 Archive and restore a record

| Item | Detail |
|---|---|
| Actors | Owner, Manager |
| Main flow | 1. The user selects Archive on a record and confirms.<br>2. The system hides the record from lists and dashboard totals and makes it read only.<br>3. To restore, the user selects Show archived, then Restore. |
| Status | Partial. Available for crop seasons and livestock; planned for other record types. |

## 5. Process flows and state models

### 5.1 Crop season

```flow
Lifecycle: Planned > Active > Harvesting > Completed
Cancellation: Planned, Active, or Harvesting > Cancelled
Archive: Any state > Archived (read only, excluded from totals) > Restored to previous state
Season process: Add field > Plan season > Record activities > Record harvests and losses > Complete season > Yield report (R1)
```

Completed and Cancelled seasons are closed: they accept no new activities or
harvests. Land is counted as used while a season is Planned, Active, or
Harvesting.

### 5.2 Livestock

```flow
Lifecycle: Registered (Active) > Sold, Transferred, Deceased, or Culled (inactive)
Health: Record health event > Next due date set > Reminder 7 days before > Followup event recorded
Breeding: Breeding recorded > Expected birth calculated > Pregnancy check > Birth recorded > Offspring registered
```

Inactive or archived animals accept no new health, breeding, or feed events.

### 5.3 Tasks

```flow
Lifecycle: Open > In progress > Completed
Cancellation: Open or In progress > Cancelled
Overdue (calculated, not stored): Due date passed and not Completed or Cancelled > Shown as overdue
```

### 5.4 Invitation

```flow
Invitation: Owner creates invitation > Code shown once > Owner shares code > Invitee signs in with invited email > Invitee enters code > Membership created
Refusal: Expired after 7 days, revoked, already used, or different email > Code refused
```

### 5.5 Stock (planned)

```flow
Receipt: Supplier delivery > Receipt recorded > Balance increases
Issue: Activity or feeding > Balance checked > Issue recorded > Balance decreases
Correction: Count difference > Adjustment with reason (Owner or Manager) > Balance corrected
```

## 6. Screen specifications

| Screen | Purpose | Main content | Actions by role | Status |
|---|---|---|---|---|
| Sign in / Register | Access the portal | Email, password, name, confirmation | All: sign in, register | Implemented |
| Dashboard | Farm overview | Cards, land chart, livestock summary, reminders | All: view; planned: open filtered lists | Partial |
| Farms | Farm setup and people | Farm cards with role; members; invitations; join with code | Owner: add, edit, invite, manage; all: select, join, leave | Implemented |
| Fields | Land units | Name, size, soil, status | Owner, Manager: add, edit | Implemented |
| Crop seasons | Seasons per field | Crop, variety, field, area, dates, status, yields | Owner, Manager: add, edit, archive, restore | Implemented |
| Crop activities | Work records | Date, season, type, cost, notes | All: add; Owner, Manager: edit | Implemented |
| Livestock | Animals and groups | Tracking, tag or group, species, breed, sex, quantity, status, location | Owner, Manager: add, edit, archive, restore | Implemented |
| Animal health | Health events | Date, animal, type, medicine, next due, cost | All: add; Owner, Manager: edit | Implemented |
| Inventory | Stock items | Item, category, quantity, unit, reorder level, expiry | Owner, Manager: add, edit; planned: movements | Partial |
| Tasks | Work allocation | Task, assignee, priority, due date, status | Owner, Manager: add, edit; assignee: update status | Implemented |
| Equipment | Equipment register | Name, category, status, next service, cost | Owner, Manager: add, edit | Partial |
| Finance | Income and expenses | Date, type, category, party, amount | Owner: add, edit | Partial |
| Reports | Mandatory reports R1 to R7 | Filters, results, totals | Owner, Manager: run, export | Planned |
| Documents | Private files | Title, file type, size, dates | Owner of file: upload, rename, replace, download, delete | Partial |
| Audit history | Change log | Date and time, user, action, record, changes | Owner: view, filter | Planned |

Common behaviour: lists support sorting, column filters, and header filters;
forms show the reason for every refusal; destructive actions ask for
confirmation; every screen works from 360 pixels wide.

## 7. Data dictionary and business rules

### 7.1 Key records

| Record | Field | Type and rules |
|---|---|---|
| Crop season | crop | Required; Maize, Beans, Potatoes, Tomatoes |
| | field | Required; a field of the same farm |
| | area_hectares | Required; greater than 0; not more than the field size |
| | planted_on, expected_harvest_date | Optional dates; harvest not before planting |
| | status | Planned, Active, Harvesting, Completed, Cancelled |
| | expected_yield_kg, harvested_kg | Optional; 0 or more |
| Livestock record | tracking_type | Individual or Group |
| | tag_number | Required for Individual; unique within the farm |
| | group_name, quantity | Group name required for Group; quantity at least 1 (1 for Individual) |
| | species | Dairy cattle, Goats, Sheep, Poultry |
| | status | Active, Sold, Transferred, Deceased, Culled |
| | birth_date | Optional; not in the future |
| Health event | animal | Required; active, unarchived animal of the same farm |
| | type | Vaccination, Treatment, Diagnosis, Deworming, Checkup |
| | event_date, next_due_date | Event date required; next due not before event |
| | cost_kes | 0 or more; defaults to 0 |
| Crop activity | crop season | Required; open season of the same farm |
| | type | Land preparation, Planting, Irrigation, Fertilizer, Spraying, Scouting, Weeding, Harvesting |
| Task | assignee | Optional; a member of the same farm |
| | priority, status | Low, Medium, High; Open, In progress, Completed, Cancelled |
| Invitation | email, role | Valid email; Manager or Worker |
| | code | 40 random characters; stored only as a SHA-256 hash; expires after 7 days; single use |
| Finance record | type, amount_kes | Income or Expense; amount greater than 0 |
| Harvest (planned) | date, quantity_kg, grade, loss_kg, destination, storage | Quantity and loss 0 or more |
| Stock movement (planned) | item, type, quantity, date, location, unit_cost, linked record | Type: Receipt, Issue, Transfer, Adjustment; quantity greater than 0 |

### 7.2 Business rules

| ID | Rule |
|---|---|
| BR-01 | Every operational record belongs to exactly one farm, and every query is limited to the active farm. |
| BR-02 | Linked records (field, season, animal, assignee, item) must belong to the same farm. |
| BR-03 | Closed or archived records accept no new activity until reopened or restored. |
| BR-04 | Archived records are read only and excluded from totals and reports unless requested. |
| BR-05 | A crop season's area cannot exceed its field's size. Land used is the sum of areas of Planned, Active, and Harvesting seasons. |
| BR-06 | Individual animals always have a quantity of 1. Tags are unique within a farm. |
| BR-07 | A task is overdue when its due date is before today (Nairobi date) and it is not Completed or Cancelled. |
| BR-08 | Stock balance = receipts minus issues, plus or minus adjustments and transfers. An issue cannot exceed the balance. (planned) |
| BR-09 | Gross margin = income minus direct expenses for the period; it is not audited profit. |
| BR-10 | Removing a member unassigns their tasks. The Owner cannot be removed. |
| BR-11 | All amounts are KES with two decimal places; quantities and amounts cannot be negative. |

## 8. Report specifications

All reports apply to the active farm, exclude archived records unless the
"include archived" filter is set, and export to CSV with the same rows and
columns shown. Status of all reports: Planned.

| Report | Filters | Columns | Calculations |
|---|---|---|---|
| R1 Crop activity and yield | Period, crop, field, season status | Season, field, area, activities count, input cost, harvested kg, loss kg, expected kg, yield per ha, variance | Yield per ha = harvested kg / area; variance = harvested minus expected, as kg and percent |
| R2 Livestock inventory and health due | Species, status, location, due within days | Animal or group, species, quantity, status, last health event, next due date, days overdue | Head count = sum of quantity of active records; overdue = next due before today |
| R3 Breeding and expected births | Period, species | Female, breeding date, method, sire, pregnancy result, expected birth | Expected birth = breeding date plus species gestation |
| R4 Feed and inventory balance | Category, location, low stock only, expiring within days | Item, unit, opening, receipts, issues, adjustments, closing, reorder level, expiry | Closing = opening + receipts minus issues plus or minus adjustments; low stock = closing at or below reorder level |
| R5 Task status | Period, assignee, priority, status | Task, assignee, priority, due date, status, overdue days, completed date | Completion rate = completed / (total minus cancelled) |
| R6 Maintenance due | Category, status, due within days | Equipment, category, status, last service, next service, days overdue, cost in period | Overdue = next service before today |
| R7 Expenses, sales, and gross margin | Period, category, enterprise | Category or enterprise, income, expenses, gross margin | Gross margin = income minus expenses; totals equal the sum of the records |

## 9. Dashboard specification

| Card | Calculation | Opens | Status |
|---|---|---|---|
| Active crop seasons | Count of unarchived seasons in Planned, Active, Harvesting | Crop seasons filtered to those states | Implemented (drill down planned) |
| Livestock count | Sum of quantity of active, unarchived records | Livestock filtered to Active | Implemented (drill down planned) |
| Crop records | Count of unarchived seasons | Crop seasons | Implemented |
| Farm size | Registered farm hectares | Farms | Implemented |
| Land utilization | Used, available, and overallocated hectares by crop (BR-05) | Crop seasons | Implemented |
| Livestock summary | Active quantity by species | Livestock by species | Implemented |
| Overdue tasks | Count per BR-07 | Tasks filtered to overdue | Planned |
| Health due | Events with next due date within 7 days or past | Animal health filtered | Planned |
| Low stock | Items at or below reorder level | Inventory filtered | Planned |
| Maintenance due | Equipment with next service within 7 days or past | Equipment filtered | Planned |
| Income and expenses this month | Sums for the current Nairobi calendar month; finance roles only | Finance filtered to month | Planned |

## 10. Interfaces

The portal calls a JSON API on the same origin. All changes require a valid
session and antiforgery token.

| Method and path | Purpose | Minimum role |
|---|---|---|
| GET, POST /api/farms; PUT /api/farms/{farm} | List with role; create; edit | Any user; Owner to edit |
| GET /api/farms/{farm}/overview | Dashboard figures | Worker |
| GET, POST /api/farms/{farm}/crops; PUT, PATCH .../crops/{crop}[/archive] | Crop seasons, edit, archive or restore | Worker to view; Manager to change |
| GET, POST /api/farms/{farm}/livestock; PUT, PATCH .../livestock/{id}[/archive] | Livestock, edit, archive or restore | Worker to view; Manager to change |
| GET, POST, PUT /api/farms/{farm}/operations/{module}[/{record}] | Fields, activities, health, inventory, tasks, equipment, finance | Section 3 |
| PATCH /api/farms/{farm}/tasks/{task}/status | Task status | Worker for own tasks |
| GET /api/farms/{farm}/members; PATCH, DELETE .../members/{user} | Members, role change, remove or leave | Worker to view; Owner or self to change |
| GET, POST, DELETE /api/farms/{farm}/invitations[/{id}] | Invitations | Owner |
| POST /api/farm-invitations/accept | Accept a code | Any user |

Planned functions (harvests, incidents, breeding, stock movements, maintenance,
reports, audit, farm documents) follow the same farm scoped pattern under
/api/farms/{farm}/.

## 11. Validation, errors, and messages

| Situation | Response | Message shown |
|---|---|---|
| Not signed in or session expired | 401 or 419 | Your session expired. Please log in again. |
| Record of a farm the user does not belong to | 404 | This item is unavailable. Refresh the list. |
| Role does not permit the action | 403 | Your farm role does not allow this action. |
| Editing an archived record | 409 | Restore this record before editing it. |
| Invalid input | 422 | The specific field message, for example "The selected field does not belong to this farm." |
| Too many attempts | 429 | Too many attempts. Please wait a minute and try again. |
| Server unreachable | 0 | The server is unavailable. Check your connection and try again. |

## 12. Nonfunctional implementation

| Requirement | How the portal meets it | Status |
|---|---|---|
| URS-Q01 Security | Hashed passwords with strength rules, sign in limits, 120-minute sessions, HttpOnly cookies, antiforgery tokens, HTTPS in production | Implemented (HTTPS at deployment) |
| URS-Q02 Authorization | Server side membership and capability check on every farm request | Implemented |
| URS-Q03 Privacy | Minimal personal data; private file storage with random names | Implemented |
| URS-Q04 Performance | Indexed farm scoped queries; server pagination for crops and livestock | Partial: pagination of other modules and load testing planned |
| URS-Q05 Usability | Responsive layouts, keyboard focus, field level messages | Partial: formal accessibility audit planned |
| URS-Q06 Compatibility | Standard web technologies; tested in Edge and Chrome | Partial: Firefox and Safari testing planned |
| URS-Q07 Integrity | Database transactions for farm creation, membership, and invitation changes | Partial: stock and finance transactions planned with those modules |
| URS-Q08, Q09 Availability, backup | Hosting and backup procedure defined in README | Planned for production |
| URS-Q10 Maintainability | Modular code; automated access control tests | Implemented |
| URS-Q11 Localization | KES, metric units, Nairobi business dates | Implemented |

## 13. Requirements traceability

| Requirement | Use cases | Status | Remaining work |
|---|---|---|---|
| URS-A01 | UC-01 | Implemented | None |
| URS-A02 | UC-03, all | Implemented | System Administrator role |
| URS-A03 | None | Planned | Audit history |
| URS-A04 | UC-04, UC-05, UC-06 | Implemented | None |
| URS-A05 | UC-24 | Partial | Archive for remaining record types |
| URS-D01 | UC-21 | Partial | Inventory, task, maintenance, finance cards |
| URS-D02 | UC-21 | Planned | Reminders |
| URS-D03 | UC-21 | Planned | Drill down |
| URS-C01 | UC-02, UC-07 | Implemented | None |
| URS-C01A | UC-02, UC-03 | Implemented | None |
| URS-C02 | UC-08 | Partial | Responsible person |
| URS-C03 | UC-09 | Implemented | None |
| URS-C04 | UC-09 | Partial | Labour, inventory usage, attachments |
| URS-C05 | UC-11 | Planned | Incident records |
| URS-C06 | UC-10 | Partial | Itemised harvest records |
| URS-C07 | UC-10, UC-22 | Partial | Yield comparison and season history view |
| URS-L01 | UC-12 | Implemented | None |
| URS-L02 | UC-12 | Partial | Source and parentage |
| URS-L03 | None | Planned | Measurements |
| URS-L04 | UC-13 | Partial | Diagnosis, dose, withdrawal, provider |
| URS-L05 | UC-14 | Planned | Breeding and births |
| URS-L06 | UC-15 | Partial | Exit details and linked sale |
| URS-L07 | UC-13, UC-21 | Planned | Reminders and history view |
| URS-I01 | UC-16 | Partial | Locations and suppliers |
| URS-I02 | UC-16 | Planned | Stock movements |
| URS-I03 | UC-09, UC-16 | Planned | Activity consumption |
| URS-I04 | UC-16 | Partial | Movement based balance check |
| URS-I05 | UC-16 | Planned | Feed allocation |
| URS-T01 | UC-17 | Implemented | None |
| URS-T02 | UC-18 | Implemented | None |
| URS-T03 | UC-18, UC-21 | Partial | Automatic overdue display |
| URS-E01 | UC-19 | Partial | Maintenance history and interval |
| URS-E02 | UC-21 | Planned | Dashboard card |
| URS-F01 | UC-20 | Implemented | Enterprise link and payment reference |
| URS-F02 | UC-20 | Partial | Product, quantity, unit price, payment status |
| URS-F03 | UC-22 | Planned | Finance summary |
| URS-M01 | UC-23 | Partial | Attach to farm records |
| URS-M02 | UC-23 | Implemented | Extend to farm shared files |
| URS-R01 | UC-22 | Planned | Reports R1 to R7 |
| URS-R02 | UC-22 | Planned | Filters and CSV export |

## 14. Acceptance test cases

| ID | Test | Expected result | Covers | Status |
|---|---|---|---|---|
| AT-01 | Register with a weak password, then a strong one; sign out and open a farm page | Weak refused; strong accepted; farm page refused after sign out | URS-A01, Q01 | Automated, passing |
| AT-02 | User B requests User A's farm, crops, and livestock | Not found for every request | URS-A02, Q02 | Automated, passing |
| AT-03 | Create a season larger than its field; then a valid season; edit, archive, restore | Oversize refused; archived season leaves totals and returns on restore; edits of archived season refused | URS-C02, A05 | Automated, passing |
| AT-04 | Record an activity on another farm's season and on a completed season | Both refused; activity on an open season accepted | URS-C03, BR-02, BR-03 | Automated, passing |
| AT-05 | Duplicate tag; edit animal; archive; record health event on archived animal | Duplicate refused; event on archived animal refused | URS-L01, L04 | Automated, passing |
| AT-06 | Owner invites; a different account uses the code; invitee uses it twice; revoked code used | Only the invitee's first use succeeds | URS-A04 | Automated, passing |
| AT-07 | Worker creates a crop, views finance, edits a task, updates own and another's task | Only own task status and activity recording succeed | URS-A02, T02 | Automated, passing |
| AT-08 | Owner removes a Worker with assigned tasks | Tasks unassigned; Worker loses access | URS-A04, BR-10 | Automated, passing |
| AT-09 | Reload the portal after selecting a farm; then lose membership and reload | Same farm restored; then first available farm | Section 2.3 | Automated, passing |
| AT-10 | Record harvests and compare with expected yield | Season total equals sum; R1 variance correct | URS-C06, C07 | Planned |
| AT-11 | Issue more stock than available; issue via activity | Overissue refused; balance changes once | URS-I02, I03, I04 | Planned |
| AT-12 | Task passes due date | Shown as overdue on list and dashboard | URS-T03, D02 | Planned |
| AT-13 | Run each report R1 to R7 and export CSV | Totals match records; CSV equals screen | URS-R01, R02, F03 | Planned |
| AT-14 | Change an operational record and view audit history | Entry shows user, time, and change | URS-A03 | Planned |
| AT-15 | Use each screen at 360 pixels and by keyboard only | All functions usable | URS-Q05 | Planned (manual) |

