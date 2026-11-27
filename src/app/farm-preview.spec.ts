import { addDays, buildReminders, nairobiToday } from './farm-reminders';
import { ReportData, runReport, toCsv } from './farm-reports';
import { COVERAGE } from './farm-coverage';
import { CropSeason, farmCan, LivestockRecord } from './farm.service';

const today = '2026-11-26';

describe('Dashboard reminders', () => {
  it('uses the Nairobi calendar date', () => {
    expect(nairobiToday(new Date('2026-11-25T22:30:00Z'))).toBe('2026-11-26');
    expect(addDays('2026-11-26', 7)).toBe('2026-12-03');
  });

  it('counts overdue tasks, due health and maintenance, low stock and this month finance', () => {
    const r = buildReminders(
      {
        tasks: [
          { title: 'Spray', due_date: '2026-11-20', status: 'Open' },
          { title: 'Done late', due_date: '2026-11-20', status: 'Completed' },
          { title: 'Future', due_date: '2026-12-20', status: 'Open' },
        ],
        health: [
          { type: 'Vaccination', next_due_date: '2026-11-30', animal_label: 'KE-001' },
          { type: 'Deworming', next_due_date: '2027-01-30' },
        ],
        inventory: [
          { name: 'DAP', quantity: '10', reorder_level: '10', unit: 'kg' },
          { name: 'Seed', quantity: '50', reorder_level: '5', unit: 'kg' },
        ],
        equipment: [{ name: 'Tractor', next_service_date: '2026-11-01', status: 'Operational' }],
        finance: [
          { type: 'Income', amount_kes: '5000.00', transaction_date: '2026-11-03' },
          { type: 'Expense', amount_kes: '1200.50', transaction_date: '2026-11-10' },
          { type: 'Income', amount_kes: '9999', transaction_date: '2026-10-31' },
        ],
      },
      today,
    );
    expect([r.overdueTasks, r.healthDue, r.lowStock, r.maintenanceDue]).toEqual([1, 1, 1, 1]);
    expect(r.month).toEqual({ income: 5000, expenses: 1200.5 });
    expect(r.items[0].overdue).toBe(true);
  });

  it('omits finance for members without finance access', () => {
    expect(
      buildReminders({ tasks: [], health: [], inventory: [], equipment: [], finance: null }, today)
        .month,
    ).toBeNull();
  });
});

describe('Reports', () => {
  const crop = {
    id: 'c1',
    crop: 'Maize',
    variety: 'H614D',
    field_name: 'North',
    area_hectares: '2.00',
    planted_on: '2026-03-01',
    status: 'Active',
    expected_yield_kg: '4000',
    harvested_kg: '5000',
  } as CropSeason;
  const data: ReportData = {
    crops: [crop],
    livestock: [
      {
        id: 'l1',
        tag_number: 'KE-1',
        group_name: null,
        species: 'Dairy cattle',
        quantity: 1,
        status: 'Active',
        location: null,
      } as LivestockRecord,
    ],
    activities: [
      { crop_season_id: 'c1', cost_kes: '300' },
      { crop_season_id: 'c1', cost_kes: '200' },
    ],
    health: [
      {
        livestock_record_id: 'l1',
        type: 'Treatment',
        event_date: '2026-11-01',
        next_due_date: '2026-11-20',
      },
    ],
    inventory: [
      {
        id: 'i1',
        name: 'DAP',
        category: 'Fertilizer',
        unit: 'kg',
        quantity: '100',
        reorder_level: '50',
      },
    ],
    tasks: [
      { title: 'A', status: 'Completed', due_date: '2026-11-01' },
      { title: 'B', status: 'Open', due_date: '2026-11-21' },
      { title: 'C', status: 'Cancelled', due_date: '2026-11-01' },
    ],
    equipment: [],
    finance: [
      { type: 'Income', category: 'Milk', amount_kes: '1000', transaction_date: '2026-11-01' },
      { type: 'Expense', category: 'Milk', amount_kes: '400', transaction_date: '2026-11-02' },
    ],
    harvests: [{ crop_season_id: 'c1', loss_kg: 120 }],
    breeding: [],
    movements: [
      { inventory_item_id: 'i1', type: 'Receipt', quantity: 20 },
      { inventory_item_id: 'i1', type: 'Issue', quantity: 80 },
    ],
    maintenance: [],
  };
  const filter = { from: '', to: '', today, dueWithin: 7 };

  it('R1 calculates input cost, yield per hectare and variance', () => {
    const row = runReport('R1', data, filter).rows[0];
    expect(row).toMatchObject({
      activities: 2,
      input_cost: 500,
      loss: 120,
      yield_per_ha: 2500,
      variance: 1000,
      variance_pct: 25,
    });
  });

  it('R2 reports days overdue for health events', () => {
    expect(runReport('R2', data, filter).rows[0]).toMatchObject({
      next_due: '2026-11-20',
      days_overdue: 6,
    });
  });

  it('R4 works the opening balance back from the live balance and movements', () => {
    expect(runReport('R4', data, filter).rows[0]).toMatchObject({
      opening: 160,
      receipts: 20,
      issues: 80,
      closing: 100,
      low: 'No',
    });
    // Movements after the period end are taken off the live balance to give that day's closing stock.
    const ended = {
      ...data,
      movements: [
        ...data.movements.map((m) => ({ ...m, moved_on: '2026-11-01' })),
        { inventory_item_id: 'i1', type: 'Issue', quantity: 70, moved_on: '2026-11-20' },
      ],
    };
    expect(runReport('R4', ended, { ...filter, to: '2026-11-10' }).rows[0]).toMatchObject({
      closing: 170,
      opening: 230,
      low: 'No',
    });
  });

  it('R5 excludes cancelled tasks from the completion rate', () => {
    const r = runReport('R5', data, filter);
    expect(r.summary.find((s) => s.label === 'Completion rate')?.value).toBe('50%');
    expect(r.rows.find((t) => t['task'] === 'B')?.['overdue_days']).toBe(5);
  });

  it('R7 totals gross margin by category and exports matching CSV', () => {
    const r = runReport('R7', data, filter);
    expect(r.rows).toEqual([{ category: 'Milk', income: 1000, expenses: 400, margin: 600 }]);
    expect(toCsv(r).split('\r\n')).toEqual([
      'Category,Income (KES),Expenses (KES),Gross margin (KES)',
      'Milk,1000,400,600',
    ]);
  });
});

describe('Finance access', () => {
  it('follows the farm setting for Managers and is always on for Owners', () => {
    expect(farmCan.seeFinance({ role: 'Owner' })).toBe(true);
    expect(farmCan.seeFinance({ role: 'Manager' })).toBe(false);
    expect(farmCan.seeFinance({ role: 'Manager', finance_access: true })).toBe(true);
    expect(farmCan.seeFinance(null)).toBe(false);
  });
});

describe('Functional coverage', () => {
  it('marks every function as working', () => {
    expect(COVERAGE.every((r) => r.status === 'Working')).toBe(true);
  });

  it('lists every FS use case', () => {
    const covered = new Set(COVERAGE.map((r) => r.ref));
    for (let n = 1; n <= 24; n++) expect(covered).toContain(`UC-${String(n).padStart(2, '0')}`);
  });
});
