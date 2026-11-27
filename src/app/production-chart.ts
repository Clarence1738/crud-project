import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DxChartComponent } from 'devextreme-angular/ui/chart';
import { errorMessage } from './api.service';
import { FarmService, ProductionCompare, ProductionSession, ProductionTrend } from './farm.service';

/** Fixed session order and colours (validated categorical slots 1–4), so a session keeps its colour. */
export const SESSION_COLORS: Record<ProductionSession, string> = {
  Morning: '#257de0',
  Midday: '#f47230',
  Evening: '#00b894',
  'Whole day': '#f2a600',
};

/**
 * Fixed colour per animal type, deliberately different from the session colours so the two
 * views are never confused (validated: CVD and normal-vision separation pass in this order).
 */
export const SPECIES_COLORS: Record<string, string> = {
  'Dairy cattle': '#6a4ce2',
  Goats: '#ee7fac',
  Sheep: '#008a17',
  Poultry: '#f2a600',
};

type SplitBy = 'session' | 'species';
type TooltipInfo = { argumentText?: string; points?: { seriesName?: string; value?: unknown }[] };

/**
 * Every livestock produce recorded in the last 14 days (milk, eggs, wool): one today-vs-yesterday
 * table grouped by produce, and one chart per produce, each on its own scale because litres and
 * eggs cannot share an axis. Produce with no records is left out, and with none at all the
 * panel is not shown.
 */
@Component({
  selector: 'app-production-chart',
  imports: [DecimalPipe, RouterLink, DxChartComponent],
  styleUrls: ['./production.css', './farm-theme.css'],
  template: `@if (loading() || error() || trends().length) {
  <section class="production-panel" aria-labelledby="production-title">
    <div class="panel-heading">
      <div>
        <h2 id="production-title">Livestock production</h2>
        <p>{{ producedList() }} · today, yesterday and the last 14 days</p>
      </div>
      @if (trends().length) {
        <div class="segmented" role="group" aria-label="Split bars by">
          <button type="button" [class.active]="splitBy() === 'session'" [attr.aria-pressed]="splitBy() === 'session'" (click)="splitBy.set('session')">By session</button>
          <button type="button" [class.active]="splitBy() === 'species'" [attr.aria-pressed]="splitBy() === 'species'" (click)="splitBy.set('species')">By animal type</button>
        </div>
      }
    </div>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    } @else if (loading()) {
      <div class="production-loading" aria-busy="true"><span class="sk-block"></span></div>
    } @else {
      <section class="compare" aria-labelledby="compare-title">
        <h3 id="compare-title" class="compare-title">Today vs yesterday</h3>
        <div class="compare-wrap">
          <table class="compare-table">
            <thead>
              <tr>
                <th scope="col" rowspan="2" class="name">Produce</th>
                <th scope="colgroup" colspan="2" class="group">Total for the day</th>
                <th scope="col" rowspan="2">Change</th>
                <th scope="col" rowspan="2">Recorded today</th>
                <th scope="col" rowspan="2" class="session-col" title="Yesterday's total divided by the animals recorded (a flock counts every bird)">Per animal yesterday</th>
              </tr>
              <tr>
                <th scope="col" class="sub">Today</th><th scope="col" class="sub">Yesterday</th>
              </tr>
            </thead>
            @for (t of trends(); track t.kind) {
              <tbody>
                <tr class="kind-row">
                  <th scope="rowgroup" [attr.colspan]="columnCount" class="name">{{ t.kind }} <span>({{ t.unit }})</span></th>
                </tr>
                @for (c of rowsFor(t); track c.species ?? 'all') {
                  <tr [class.total]="!c.species">
                    <th scope="row" class="name">
                      @if (c.species) {
                        <i [style.background]="speciesColor(c.species)" aria-hidden="true"></i>{{ c.species }}
                      } @else {
                        All {{ t.kind.toLowerCase() }}
                      }
                    </th>
                    <td class="strong">{{ c.today | number: '1.0-1' }}</td>
                    <td class="muted">{{ c.yesterday | number: '1.0-1' }}</td>
                    <td>
                      @let change = dayChange(c);
                      @if (change === 'incomplete') {
                        <span class="change pending" title="Today is still being recorded, so comparing it with yesterday's full day would be misleading">Incomplete</span>
                      } @else if (change === null) {
                        <span class="change">—</span>
                      } @else {
                        <span class="change" [class.up]="change > 0" [class.down]="change < 0">
                          <span aria-hidden="true">{{ change > 0 ? '▲' : change < 0 ? '▼' : '■' }}</span>
                          {{ change > 0 ? '+' : '' }}{{ change | number: '1.0-1' }}%
                        </span>
                      }
                    </td>
                    <td [class.pending]="c.animals_today < c.animals_active">
                      {{ c.animals_today }} / {{ c.animals_active }}
                      @if (c.animals_today < c.animals_active && c.species) {
                        <a routerLink="/production">Record</a>
                      }
                    </td>
                    <td class="muted session-col">{{ c.per_animal_yesterday === null ? '—' : (c.per_animal_yesterday | number: '1.0-1') }}</td>
                  </tr>
                }
              </tbody>
            }
          </table>
        </div>
        <p class="compare-note">Change compares today's total with yesterday's. It shows as Incomplete until every animal has been recorded for every milking yesterday had.</p>
      </section>
      <div class="produce-charts">
        @for (c of charts(); track c.key) {
          <article class="produce-chart">
            <header>
              <div>
                <h3>{{ c.trend.kind }} <span>· {{ c.trend.unit }} per day</span></h3>
                <p>
                  Average {{ c.trend.last7_average | number: '1.0-1' }} {{ c.trend.unit }} a day over the last 7 days
                  @if (c.trend.change_percent !== null) {
                    <span class="change" [class.up]="c.trend.change_percent > 0" [class.down]="c.trend.change_percent < 0"
                      [attr.aria-label]="'Against the 7 days before: ' + c.trend.change_percent + '%'">
                      <span aria-hidden="true">{{ c.trend.change_percent > 0 ? '▲' : c.trend.change_percent < 0 ? '▼' : '■' }}</span>
                      {{ c.trend.change_percent > 0 ? '+' : '' }}{{ c.trend.change_percent | number: '1.0-1' }}% vs week before
                    </span>
                  }
                </p>
              </div>
            </header>
            <dx-chart
              [dataSource]="c.trend.series"
              [commonSeriesSettings]="seriesSettings"
              [series]="c.series"
              [legend]="{ visible: c.series.length > 1, verticalAlignment: 'bottom', horizontalAlignment: 'center', font: { color: '#4b5563' } }"
              [valueAxis]="c.valueAxis"
              [argumentAxis]="argumentAxis"
              [tooltip]="{ enabled: true, shared: true, customizeTooltip: c.tooltip }"
              [size]="{ height: 250 }"
            ></dx-chart>
            <p class="sr-only">{{ c.summary }}</p>
          </article>
        }
      </div>
    }
  </section>
}`,
})
export class ProductionChart {
  private readonly service = inject(FarmService);
  readonly farmId = input<string | null>(null);
  /** Bump to reload after a sheet is saved. */
  readonly refresh = input(0);
  readonly trends = signal<ProductionTrend[]>([]);
  readonly splitBy = signal<SplitBy>('session');
  readonly loading = signal(true);
  readonly error = signal('');
  readonly seriesSettings = { argumentField: 'day', type: 'stackedbar' as const, barPadding: 0.35, cornerRadius: 4, border: { visible: true, color: '#ffffff', width: 2 } };
  /** Recessive axes: muted labels, light grid, no ticks. */
  readonly argumentAxis = { label: { font: { color: '#6b7280' }, overlappingBehavior: 'hide' as const }, tick: { visible: false } };

  readonly producedList = computed(() => {
    const kinds = this.trends().map((t) => t.kind.toLowerCase());
    const text = kinds.length > 1 ? `${kinds.slice(0, -1).join(', ')} and ${kinds.at(-1)}` : (kinds[0] ?? 'milk, eggs and wool');
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
  readonly columnCount = 6;
  /** One chart per produce; rebuilt (new key) when the split changes so DevExtreme redraws cleanly. */
  readonly charts = computed(() =>
    this.trends().map((t) => {
      const series =
        this.splitBy() === 'species'
          ? t.species.map((s) => ({ valueField: `species:${s}`, name: s, color: this.speciesColor(s) }))
          : (Object.keys(SESSION_COLORS) as ProductionSession[])
              .filter((s) => t.series.some((p) => p[s] > 0))
              .map((s) => ({ valueField: s, name: s, color: SESSION_COLORS[s] }));
      return {
        key: `${t.kind}-${this.splitBy()}`,
        trend: t,
        series,
        valueAxis: [{ grid: { color: '#eef1ee' }, label: { font: { color: '#6b7280' } }, allowDecimals: t.kind !== 'Eggs' }],
        tooltip: this.tooltipFor(t.unit),
        summary: `${t.kind}: today ${t.today} ${t.unit}, 7-day daily average ${t.last7_average} ${t.unit}. ` +
          t.by_species.map((s) => `${s.species} ${s.today} ${t.unit} today`).join(', '),
      };
    }),
  );

  /** Animal types first, then the all-animals total when there is more than one. */
  /**
   * Today's total against yesterday's. Until today is complete (every animal recorded, and at
   * least as many sessions as yesterday) the change would be misleading, so it is withheld.
   */
  dayChange(c: ProductionCompare): number | null | 'incomplete' {
    if (!c.yesterday) return null;
    const sessionsToday = c.sessions.filter((s) => s.today > 0).length;
    const sessionsYesterday = c.sessions.filter((s) => s.yesterday > 0).length;
    if (c.today > 0 && (c.animals_today < c.animals_active || sessionsToday < sessionsYesterday)) return 'incomplete';
    if (!c.today) return 'incomplete';
    return Math.round(((c.today - c.yesterday) / c.yesterday) * 1000) / 10;
  }
  rowsFor(t: ProductionTrend): ProductionCompare[] {
    return [...t.compare.filter((c) => c.species), ...t.compare.filter((c) => !c.species)];
  }
  speciesColor(name: string): string {
    return SPECIES_COLORS[name] ?? '#6b7280';
  }
  private tooltipFor(unit: string) {
    return (info: TooltipInfo) => {
      const points = info.points ?? [];
      const rows = points.filter((p) => Number(p.value) > 0).map((p) => `${p.seriesName}: ${p.value} ${unit}`);
      const total = points.reduce((sum, p) => sum + Number(p.value || 0), 0);
      return { text: `${info.argumentText ?? ''}\n${rows.join('\n')}${rows.length > 1 ? `\nTotal: ${Math.round(total * 10) / 10} ${unit}` : ''}` };
    };
  }

  constructor() {
    effect(() => {
      const id = this.farmId();
      this.refresh();
      if (id) untracked(() => void this.load(id));
    });
  }

  private async load(id: string): Promise<void> {
    this.error.set('');
    if (!this.trends().length) this.loading.set(true);
    try {
      const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const trends = await this.service.productionSummary(id, 14);
      // Leave out produce with nothing in the 14 days shown.
      this.trends.set(trends.filter((t) => t.series.some((p) => p.total > 0)).map((t) => ({ ...t, series: t.series.map((p) => ({ ...p, day: day.format(new Date(p.date + 'T00:00:00Z')) })) })));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
