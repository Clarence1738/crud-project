# Farm Management System - Initial Design

**Based on:** URS v0.2 and FS v0.2  
**Status:** Initial implementation design

## 1. Portal sitemap

~~~text
Farm selector
|-- Dashboard
|-- Crops: fields, seasons, activities, harvests
|-- Livestock: animals, groups, health, breeding, production
|-- Inventory: items, movements, feed, suppliers
|-- Tasks
|-- Equipment and maintenance
|-- Finance: expenses and sales
|-- Reports
|-- Documents
|-- Settings: farms, access, crops, livestock, units
~~~

## 2. Core data relationships

~~~mermaid
erDiagram
    USER ||--o{ FARM_MEMBERSHIP : receives
    FARM ||--o{ FARM_MEMBERSHIP : grants
    FARM ||--o{ FIELD : contains
    FARM ||--o{ LIVESTOCK_GROUP : contains
    FARM ||--o{ ANIMAL : owns
    FARM ||--o{ INVENTORY_ITEM : stocks
    FARM ||--o{ TASK : schedules
    FARM ||--o{ EQUIPMENT : owns
    FARM ||--o{ EXPENSE : records
    FARM ||--o{ SALE : records
    FIELD ||--o{ CROP_SEASON : hosts
    CROP ||--o{ CROP_VARIETY : has
    CROP_VARIETY ||--o{ CROP_SEASON : planted_as
    CROP_SEASON ||--o{ CROP_ACTIVITY : includes
    CROP_SEASON ||--o{ HARVEST : produces
    LIVESTOCK_GROUP ||--o{ ANIMAL : groups
    ANIMAL ||--o{ HEALTH_EVENT : receives
    LIVESTOCK_GROUP ||--o{ HEALTH_EVENT : receives
    ANIMAL ||--o{ BREEDING_EVENT : participates
    ANIMAL ||--o{ MEASUREMENT : produces
    INVENTORY_ITEM ||--o{ STOCK_MOVEMENT : moves
    EQUIPMENT ||--o{ MAINTENANCE_RECORD : receives
    USER ||--o{ TASK : assigned
~~~

Documents, Tasks, Expenses, Sales, and stock movements can link to relevant
crop, livestock, inventory, or equipment records.

## 3. Farm access rules

1. Every operational request resolves one active farm.
2. The user must have an active membership for that farm.
3. Queries apply farm scope before search or other filters.
4. Policies check farm membership and role capability.
5. Owners may view an All farms summary, but edits target one farm.
6. Related records from different farms cannot be combined.

## 4. Demo seed data

| Category | Demonstration data |
|---|---|
| Farms | Green Valley Farm in Nakuru; Sunrise Farm in Kiambu |
| Crops | Maize, beans, potatoes, tomatoes |
| Crop varieties | H614D, Rosecoco, Shangi, Anna F1 |
| Dairy cattle | Friesian, Ayrshire |
| Goats | Galla, dairy goat |
| Sheep | Dorper |
| Poultry | Layers, broilers |

Seed data is for demonstration and remains editable.

## 5. Release phases

### Phase 1 - Foundation

- Accounts, farms, farm selector, memberships, roles, audit, and documents.

### Phase 2 - Crop operations

- Fields, crops, varieties, seasons, activities, inputs, harvests, and reports.

### Phase 3 - Livestock operations

- Animals, groups, flocks, health, breeding, births, production, and reports.

### Phase 4 - Farm resources

- Inventory, feed, suppliers, tasks, equipment, and maintenance.

### Phase 5 - Finance and reporting

- Expenses, sales, KES summaries, dashboard metrics, reports, and exports.

### Phase 6 - Verification

- Automated tests, demo data, acceptance scenarios, responsive and security review.

## 6. First implementation backlog

1. Add Farm, FarmMembership, and role permission migrations.
2. Add farm-scoped authorization middleware and policies.
3. Add the active-farm selector and navigation shell.
4. Add fields and crop configuration.
5. Add crop seasons, activities, harvests, and inventory usage.
6. Verify multi-farm isolation before adding livestock modules.
