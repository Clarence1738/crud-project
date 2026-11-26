# Farm Management System

## Decision Log

| Document control | |
|---|---|
| Document ID | FMS-DEC |
| Version | 1.0 |
| Date | 25 November 2026 |
| Status | Current |
| Baseline | FMS-URS v1.0 and FMS-FS v1.0 |

## 1. Approved demonstration decisions

Approved on 23 November 2026.

| ID | Topic | Decision |
|---|---|---|
| D-01 | Ownership | One Owner can manage multiple farms. |
| D-02 | Access | Managers and Workers are assigned to farms. |
| D-03 | Demo crops | Maize, beans, potatoes, tomatoes. |
| D-04 | Demo livestock | Dairy cattle, goats, sheep, poultry. |
| D-05 | Tracking | Individual and group; poultry defaults to flock. |
| D-06 | Currency | Kenyan Shillings (KES). |
| D-07 | Measurements | kg, litres, tonnes, hectares, square metres, kilometres. |
| D-08 | Roles | Owner, Manager, Worker, System Administrator. |

## 2. Implementation decisions

Recorded on 25 November 2026. D-16 to D-20 were added with the version 1.0 specifications.

| ID | Topic | Decision | Reason |
|---|---|---|---|
| D-09 | Invitations | Invitations use a one time code that the Owner shares, valid for 7 days and only for the invited email address. No email is sent. | The system has no mail service and no email verification. Requiring both the code and the matching signed in address prevents a code being used by the wrong account. |
| D-10 | Manager finance access | Finance is limited to the Owner. | The specification marked Manager finance access as configurable. The conservative default protects financial data until a per farm setting is built. |
| D-11 | Worker updates | Workers record crop activities and animal health events, and change the status of tasks assigned to them. All other records are read only to Workers. | Matches "assigned updates" and "complete only" in the permission table without exposing configuration changes. |
| D-12 | Deletion | Crop seasons and livestock records are archived, not deleted. Archived records are read only and excluded from totals until restored. | Retains history required by URS-C07 and URS-L07. |
| D-13 | Closed records | New crop activities require an open crop season. New health events require an active, unarchived animal. | Implements "archived or closed records reject new activity". |
| D-14 | Active farm | The active farm identifier is kept in browser storage and cleared on sign out. It is used only if the user is still a member. | Restores the working context after a reload without granting access. |
| D-15 | Shipment module | The earlier shipment module remains in the code and API but is not routed in the farm portal. | Preserves completed work for a possible future decision. |
| D-16 | Priorities | Requirements are prioritised Must, Should, or Could for the first production release. | Gives a clear acceptance threshold: all Must requirements pass. |
| D-17 | Reminder window | Reminders show items due within 7 days and all overdue items; the window becomes a farm setting. | A week suits field and animal scheduling and is easy to change later. |
| D-18 | Business dates | Due, overdue, and monthly totals use the Africa/Nairobi calendar date. | Avoids items changing state at the wrong time for Kenyan users. |
| D-19 | Report export | Reports export to CSV using the same query and filters as the screen. | Guarantees the exported data matches what the user reviewed. |
| D-20 | Stock balance | Stock balance is derived from movements; direct editing of quantity is replaced by movements. | Required for an auditable balance and the no negative stock rule. |

## 3. Mandatory reports

1. Crop activity, inputs, harvest, and expected versus actual yield.
2. Livestock inventory and health events due.
3. Breeding and expected births.
4. Feed and inventory balance with low stock.
5. Tasks due, overdue, and completed.
6. Equipment maintenance due.
7. Expenses, sales, and gross margin.

Report specifications are in FMS-FS section 8; delivery status is in FMS-FS section 13.

## 4. Open decisions

| ID | Question |
|---|---|
| O-01 | Should Managers receive finance access per farm, and who grants it? |
| O-02 | How is farm ownership transferred? |
| O-03 | Should invitations be delivered by email once a mail service and email verification exist? |
| O-04 | What are the System Administrator's support capabilities, given that it has no automatic access to farm data? |

