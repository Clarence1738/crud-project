import { Component, computed, inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxChartComponent } from 'devextreme-angular/ui/chart';
import { DxPieChartComponent } from 'devextreme-angular/ui/pie-chart';
import { errorMessage } from './api.service';
import { CropSeason, Farm, farmCan, FarmService, LivestockRecord } from './farm.service';
import { addDays, nairobiToday } from './farm-reminders';
import { Skeleton } from './skeleton';

type Row = Record<string, unknown>;
export interface ReportColumn {
  key: string;
  label: string;
}
export interface ReportResult {
  columns: ReportColumn[];
  rows: Row[];
  summary: { label: string; value: string }[];
  chart?: {
    kind: 'bar' | 'pie';
    title: string;
    data: Row[];
    series: { field: string; name: string; color: string }[];
  };
}
export interface ReportData {
  crops: CropSeason[];
  livestock: LivestockRecord[];
  activities: Row[];
  health: Row[];
  inventory: Row[];
  tasks: Row[];
  equipment: Row[];
  finance: Row[] | null;
  harvests: Row[];
  breeding: Row[];
  movements: Row[];
  maintenance: Row[];
}
export interface ReportFilter {
  from: string;
  to: string;
  today: string;
  dueWithin: number;
}

export const REPORTS = [
  {
    id: 'R1',
    title: 'Crop activity and yield',
    description:
      'Activities, input cost, harvest and yield against expectation for each crop season.',
  },
  {
    id: 'R2',
    title: 'Livestock and health due',
    description: 'Animals and groups with their last health event and next due date.',
  },
  {
    id: 'R3',
    title: 'Breeding and expected births',
    description: 'Breeding services, pregnancy results and expected birth dates.',
  },
  {
    id: 'R4',
    title: 'Feed and inventory balance',
    description: 'Opening stock, movements, closing balance and low stock.',
  },
  {
    id: 'R5',
    title: 'Task status',
    description: 'Tasks by assignee, priority and status, with overdue days and completion rate.',
  },
  {
    id: 'R6',
    title: 'Maintenance due',
    description: 'Equipment service dates, overdue days and maintenance cost.',
  },
  {
    id: 'R7',
    title: 'Expenses, sales and gross margin',
    description: 'Income, expenses and gross margin by category.',
  },
] as const;
export type ReportId = (typeof REPORTS)[number]['id'];

const num = (value: unknown) => Number(value ?? 0) || 0;
const day = (value: unknown) => (typeof value === 'string' ? value.slice(0, 10) : '');
const kes = (value: number) =>
  value.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
const inPeriod = (date: string, f: ReportFilter) =>
  !!date && (!f.from || date >= f.from) && (!f.to || date <= f.to);
const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places;

/** Pure report calculations from FS section 8, kept separate from the component so they can be tested. */
export function runReport(id: ReportId, d: ReportData, f: ReportFilter): ReportResult {
  switch (id) {
    case 'R1': {
      const rows = d.crops
        .filter((c) => (!f.from && !f.to ? true : inPeriod(day(c.planted_on), f)))
        .map((crop) => {
          const acts = d.activities.filter((a) => a['crop_season_id'] === crop.id);
          const loss = d.harvests
            .filter((h) => h['crop_season_id'] === crop.id)
            .reduce((t, h) => t + num(h['loss_kg']), 0);
          const area = num(crop.area_hectares),
            harvested = num(crop.harvested_kg),
            expected = num(crop.expected_yield_kg);
          return {
            season: `${crop.crop}${crop.variety ? ' ' + crop.variety : ''}`,
            field: crop.field_name,
            area,
            status: crop.status,
            activities: acts.length,
            input_cost: acts.reduce((t, a) => t + num(a['cost_kes']), 0),
            harvested,
            loss,
            expected,
            yield_per_ha: area ? round(harvested / area) : 0,
            variance: harvested - expected,
            variance_pct: expected ? round(((harvested - expected) / expected) * 100) : null,
          };
        });
      return {
        columns: [
          { key: 'season', label: 'Season' },
          { key: 'field', label: 'Field' },
          { key: 'area', label: 'Area (ha)' },
          { key: 'status', label: 'Status' },
          { key: 'activities', label: 'Activities' },
          { key: 'input_cost', label: 'Input cost (KES)' },
          { key: 'harvested', label: 'Harvested (kg)' },
          { key: 'loss', label: 'Loss (kg)' },
          { key: 'expected', label: 'Expected (kg)' },
          { key: 'yield_per_ha', label: 'Yield per ha' },
          { key: 'variance', label: 'Variance (kg)' },
          { key: 'variance_pct', label: 'Variance (%)' },
        ],
        rows,
        summary: [
          { label: 'Seasons', value: String(rows.length) },
          { label: 'Input cost (KES)', value: kes(rows.reduce((t, r) => t + r.input_cost, 0)) },
          {
            label: 'Harvested (kg)',
            value: rows.reduce((t, r) => t + r.harvested, 0).toLocaleString(),
          },
          {
            label: 'Expected (kg)',
            value: rows.reduce((t, r) => t + r.expected, 0).toLocaleString(),
          },
        ],
        chart: {
          kind: 'bar',
          title: 'Expected versus harvested (kg)',
          data: rows.map((r) => ({
            label: `${r.season} · ${r.field}`,
            expected: r.expected,
            harvested: r.harvested,
          })),
          series: [
            { field: 'expected', name: 'Expected', color: '#a7b8b0' },
            { field: 'harvested', name: 'Harvested', color: '#3f7d4c' },
          ],
        },
      };
    }
    case 'R2': {
      const horizon = addDays(f.today, f.dueWithin);
      const rows = d.livestock.map((animal) => {
        const events = d.health
          .filter((e) => e['livestock_record_id'] === animal.id)
          .sort((a, b) => day(b['event_date']).localeCompare(day(a['event_date'])));
        const due =
          events
            .map((e) => day(e['next_due_date']))
            .filter(Boolean)
            .sort()[0] ?? '';
        return {
          animal: animal.tag_number ?? animal.group_name,
          species: animal.species,
          quantity: animal.quantity,
          status: animal.status,
          location: animal.location ?? '',
          last_event: events[0] ? `${events[0]['type']} · ${day(events[0]['event_date'])}` : 'None',
          next_due: due,
          days_overdue: due && due < f.today ? daysBetween(due, f.today) : 0,
          due_soon: !!due && due <= horizon,
        };
      });
      const species = new Map<string, number>();
      for (const r of rows)
        if (r.status === 'Active')
          species.set(r.species, (species.get(r.species) ?? 0) + r.quantity);
      return {
        columns: [
          { key: 'animal', label: 'Animal or group' },
          { key: 'species', label: 'Species' },
          { key: 'quantity', label: 'Quantity' },
          { key: 'status', label: 'Status' },
          { key: 'location', label: 'Location' },
          { key: 'last_event', label: 'Last health event' },
          { key: 'next_due', label: 'Next due' },
          { key: 'days_overdue', label: 'Days overdue' },
        ],
        rows,
        summary: [
          {
            label: 'Head count (active)',
            value: String([...species.values()].reduce((t, v) => t + v, 0)),
          },
          {
            label: `Due within ${f.dueWithin} days`,
            value: String(rows.filter((r) => r.due_soon).length),
          },
          { label: 'Overdue', value: String(rows.filter((r) => r.days_overdue > 0).length) },
        ],
        chart: {
          kind: 'pie',
          title: 'Active head count by species',
          data: [...species].map(([label, value]) => ({ label, value })),
          series: [{ field: 'value', name: 'Head count', color: '#3f7d4c' }],
        },
      };
    }
    case 'R3': {
      const rows = d.breeding
        .filter((b) => (!f.from && !f.to ? true : inPeriod(day(b['bred_on']), f)))
        .map((b) => ({
          female: b['animal_label'],
          bred_on: day(b['bred_on']),
          method: b['method'],
          sire: b['sire'],
          result: b['pregnancy_result'],
          expected_birth: day(b['expected_birth_on']),
        }));
      return {
        columns: [
          { key: 'female', label: 'Female' },
          { key: 'bred_on', label: 'Breeding date' },
          { key: 'method', label: 'Method' },
          { key: 'sire', label: 'Sire' },
          { key: 'result', label: 'Pregnancy result' },
          { key: 'expected_birth', label: 'Expected birth' },
        ],
        rows,
        summary: [
          { label: 'Services', value: String(rows.length) },
          {
            label: 'Confirmed',
            value: String(rows.filter((r) => r.result === 'Confirmed').length),
          },
          {
            label: 'Pending check',
            value: String(rows.filter((r) => r.result === 'Pending').length),
          },
        ],
      };
    }
    case 'R4': {
      const rows = d.inventory.map((item) => {
        // The item quantity is the live balance; the period's closing and opening are worked
        // back from the movements recorded after and during the period.
        const moves = d.movements.filter((m) => m['inventory_item_id'] === item['id']);
        const net = (m: Row) =>
          m['type'] === 'Receipt'
            ? num(m['quantity'])
            : m['type'] === 'Issue'
              ? -num(m['quantity'])
              : m['type'] === 'Adjustment'
                ? num(m['quantity'])
                : 0;
        const later = moves.filter((m) => !!f.to && day(m['moved_on']) > f.to);
        const during = moves.filter((m) => (!f.from && !f.to) || inPeriod(day(m['moved_on']), f));
        const sum = (type: string) =>
          during.filter((m) => m['type'] === type).reduce((t, m) => t + num(m['quantity']), 0);
        const closing = num(item['quantity']) - later.reduce((t, m) => t + net(m), 0);
        const opening = closing - during.reduce((t, m) => t + net(m), 0),
          receipts = sum('Receipt'),
          issues = sum('Issue'),
          adjustments = sum('Adjustment');
        return {
          item: item['name'],
          category: item['category'],
          unit: item['unit'],
          opening,
          receipts,
          issues,
          adjustments,
          closing,
          reorder: num(item['reorder_level']),
          expiry: day(item['expires_on']),
          low: closing <= num(item['reorder_level']) ? 'Yes' : 'No',
        };
      });
      return {
        columns: [
          { key: 'item', label: 'Item' },
          { key: 'category', label: 'Category' },
          { key: 'unit', label: 'Unit' },
          { key: 'opening', label: 'Opening' },
          { key: 'receipts', label: 'Receipts' },
          { key: 'issues', label: 'Issues' },
          { key: 'adjustments', label: 'Adjustments' },
          { key: 'closing', label: 'Closing' },
          { key: 'reorder', label: 'Reorder level' },
          { key: 'expiry', label: 'Expiry' },
          { key: 'low', label: 'Low stock' },
        ],
        rows,
        summary: [
          { label: 'Items', value: String(rows.length) },
          { label: 'Low stock', value: String(rows.filter((r) => r.low === 'Yes').length) },
          {
            label: `Expiring within ${f.dueWithin} days`,
            value: String(
              rows.filter((r) => r.expiry && r.expiry <= addDays(f.today, f.dueWithin)).length,
            ),
          },
        ],
        chart: {
          kind: 'bar',
          title: 'Closing balance against reorder level',
          data: rows.map((r) => ({
            label: String(r.item),
            closing: r.closing,
            reorder: r.reorder,
          })),
          series: [
            { field: 'closing', name: 'Closing', color: '#3f7d4c' },
            { field: 'reorder', name: 'Reorder level', color: '#d8a33f' },
          ],
        },
      };
    }
    case 'R5': {
      const rows = d.tasks
        .filter((t) => (!f.from && !f.to ? true : inPeriod(day(t['due_date']), f)))
        .map((t) => {
          const due = day(t['due_date']);
          const open = !['Completed', 'Cancelled'].includes(String(t['status']));
          return {
            task: t['title'],
            assignee: t['assignee_name'] ?? 'Unassigned',
            priority: t['priority'],
            due,
            status: t['status'],
            overdue_days: open && due && due < f.today ? daysBetween(due, f.today) : 0,
          };
        });
      const counted = rows.filter((r) => r.status !== 'Cancelled').length;
      const done = rows.filter((r) => r.status === 'Completed').length;
      const byStatus = new Map<string, number>();
      for (const r of rows)
        byStatus.set(String(r.status), (byStatus.get(String(r.status)) ?? 0) + 1);
      return {
        columns: [
          { key: 'task', label: 'Task' },
          { key: 'assignee', label: 'Assignee' },
          { key: 'priority', label: 'Priority' },
          { key: 'due', label: 'Due date' },
          { key: 'status', label: 'Status' },
          { key: 'overdue_days', label: 'Overdue days' },
        ],
        rows,
        summary: [
          { label: 'Tasks', value: String(rows.length) },
          {
            label: 'Completion rate',
            value: counted ? `${round((done / counted) * 100)}%` : 'None',
          },
          { label: 'Overdue', value: String(rows.filter((r) => r.overdue_days > 0).length) },
        ],
        chart: {
          kind: 'pie',
          title: 'Tasks by status',
          data: [...byStatus].map(([label, value]) => ({ label, value })),
          series: [{ field: 'value', name: 'Tasks', color: '#3f7d4c' }],
        },
      };
    }
    case 'R6': {
      const rows = d.equipment.map((e) => {
        const history = d.maintenance
          .filter((m) => m['farm_equipment_id'] === e['id'])
          .sort((a, b) => day(b['serviced_on']).localeCompare(day(a['serviced_on'])));
        const next = day(e['next_service_date']);
        return {
          equipment: e['name'],
          category: e['category'],
          status: e['status'],
          last_service: history[0] ? day(history[0]['serviced_on']) : 'None',
          next_service: next,
          days_overdue: next && next < f.today ? daysBetween(next, f.today) : 0,
          cost:
            num(e['maintenance_cost_kes']) +
            history
              .filter((m) => (!f.from && !f.to) || inPeriod(day(m['serviced_on']), f))
              .reduce((t, m) => t + num(m['cost_kes']), 0),
        };
      });
      return {
        columns: [
          { key: 'equipment', label: 'Equipment' },
          { key: 'category', label: 'Category' },
          { key: 'status', label: 'Status' },
          { key: 'last_service', label: 'Last service' },
          { key: 'next_service', label: 'Next service' },
          { key: 'days_overdue', label: 'Days overdue' },
          { key: 'cost', label: 'Cost (KES)' },
        ],
        rows,
        summary: [
          { label: 'Equipment', value: String(rows.length) },
          {
            label: `Due within ${f.dueWithin} days`,
            value: String(
              rows.filter((r) => r.next_service && r.next_service <= addDays(f.today, f.dueWithin))
                .length,
            ),
          },
          { label: 'Cost (KES)', value: kes(rows.reduce((t, r) => t + r.cost, 0)) },
        ],
      };
    }
    case 'R7': {
      const groups = new Map<string, { income: number; expenses: number }>();
      for (const t of (d.finance ?? []).filter((t) =>
        !f.from && !f.to ? true : inPeriod(day(t['transaction_date']), f),
      )) {
        const g = groups.get(String(t['category'])) ?? { income: 0, expenses: 0 };
        if (t['type'] === 'Income') g.income += num(t['amount_kes']);
        else g.expenses += num(t['amount_kes']);
        groups.set(String(t['category']), g);
      }
      const rows = [...groups].map(([category, g]) => ({
        category,
        income: g.income,
        expenses: g.expenses,
        margin: g.income - g.expenses,
      }));
      const total = rows.reduce(
        (t, r) => ({ income: t.income + r.income, expenses: t.expenses + r.expenses }),
        { income: 0, expenses: 0 },
      );
      return {
        columns: [
          { key: 'category', label: 'Category' },
          { key: 'income', label: 'Income (KES)' },
          { key: 'expenses', label: 'Expenses (KES)' },
          { key: 'margin', label: 'Gross margin (KES)' },
        ],
        rows,
        summary: [
          { label: 'Income (KES)', value: kes(total.income) },
          { label: 'Expenses (KES)', value: kes(total.expenses) },
          { label: 'Gross margin (KES)', value: kes(total.income - total.expenses) },
        ],
        chart: {
          kind: 'bar',
          title: 'Income and expenses by category (KES)',
          data: rows.map((r) => ({ label: r.category, income: r.income, expenses: r.expenses })),
          series: [
            { field: 'income', name: 'Income', color: '#3f7d4c' },
            { field: 'expenses', name: 'Expenses', color: '#bf563f' },
          ],
        },
      };
    }
  }
}

export function toCsv(result: ReportResult): string {
  const cell = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [
    result.columns.map((c) => cell(c.label)).join(','),
    ...result.rows.map((r) => result.columns.map((c) => cell(r[c.key])).join(',')),
  ].join('\r\n');
}

@Component({
  selector: 'app-farm-reports',
  imports: [
    FormsModule,
    DxDataGridComponent,
    DxiDataGridColumnComponent,
    DxChartComponent,
    DxPieChartComponent,
    Skeleton,
  ],
  templateUrl: './farm-reports.html',
  styleUrls: [
    './farm-module.css',
    './farm-fluid.css',
    './farm-collab.css',
    './farm-preview.css',
    './farm-theme.css',
  ],
})
export class FarmReports implements OnInit {
  private readonly service = inject(FarmService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  readonly reports = REPORTS;
  readonly farms = signal<Farm[]>([]);
  readonly farm = signal<Farm | null>(null);
  readonly data = signal<ReportData | null>(null);
  readonly selected = signal<ReportId>('R1');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly dueWithin = signal(7);
  readonly role = computed(() => this.farm()?.role ?? null);
  /** Reports are for Owners and Managers (UC-22); R7 needs finance access. */
  readonly canRun = computed(() => farmCan.manageRecords(this.role()));
  readonly available = computed(() =>
    this.reports.filter((r) => r.id !== 'R7' || farmCan.seeFinance(this.farm())),
  );
  readonly info = computed(() => this.reports.find((r) => r.id === this.selected())!);
  readonly result = computed(() => {
    const data = this.data();
    return data
      ? runReport(this.selected(), data, {
          from: this.from(),
          to: this.to(),
          today: nairobiToday(),
          dueWithin: this.dueWithin(),
        })
      : null;
  });

  readonly barSeries = computed(() =>
    (this.result()?.chart?.series ?? []).map((s) => ({
      valueField: s.field,
      name: s.name,
      color: s.color,
    })),
  );

  async ngOnInit(): Promise<void> {
    this.busy.set(true);
    try {
      const farms = await this.service.farms();
      this.farms.set(farms);
      const farm = this.service.pickFarm(farms);
      if (farm) await this.selectFarm(farm.id);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async selectFarm(id: string): Promise<void> {
    const farm = this.farms().find((f) => f.id === id) ?? null;
    this.farm.set(farm);
    this.data.set(null);
    if (!farm) return;
    this.service.selectFarm(id);
    if (!this.available().some((r) => r.id === this.selected())) this.selected.set('R1');
    if (!this.canRun()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const op = (module: string) => this.service.operations(id, module);
      const [
        crops,
        livestock,
        activities,
        health,
        inventory,
        tasks,
        equipment,
        finance,
        harvests,
        breeding,
        movements,
        maintenance,
      ] = await Promise.all([
        this.service.crops(id),
        this.service.livestock(id),
        op('activities'),
        op('health'),
        op('inventory'),
        op('tasks'),
        op('equipment'),
        farmCan.seeFinance(farm) ? op('finance') : Promise.resolve(null),
        op('harvests'),
        op('breeding'),
        op('movements'),
        op('maintenance'),
      ]);
      this.data.set({
        crops: crops.data,
        livestock: livestock.data,
        activities,
        health,
        inventory,
        tasks,
        equipment,
        finance,
        harvests,
        breeding,
        movements,
        maintenance,
      });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  exportCsv(): void {
    const result = this.result();
    const farm = this.farm();
    if (!result || !farm || !this.browser) return;
    const url = URL.createObjectURL(new Blob([toCsv(result)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${farm.name} ${this.info().id} ${this.info().title} ${nairobiToday()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }
}
