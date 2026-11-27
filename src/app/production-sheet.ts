import { Component, computed, ElementRef, inject, input, output, signal, effect, untracked } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { errorMessage } from './api.service';
import { Farm, farmCan, FarmService, ProductionKind, ProductionSession, ProductionSheetRow, ProductionSlot } from './farm.service';
import { nairobiToday } from './farm-reminders';
import { SESSION_COLORS } from './production-chart';

export const PRODUCTION_UNITS: Record<ProductionKind, string> = { Milk: 'litres', Eggs: 'eggs', Weight: 'kg', Wool: 'kg' };

/** Which animals a measure usually applies to, so the sheet starts with the right list. */
export function appliesTo(kind: ProductionKind, row: Pick<ProductionSheetRow, 'species' | 'sex'>): boolean {
  if (kind === 'Milk') return row.species !== 'Poultry' && row.sex !== 'Male';
  if (kind === 'Eggs') return row.species === 'Poultry';
  if (kind === 'Wool') return row.species === 'Sheep';
  return true;
}

/** Morning before noon, otherwise Evening (Nairobi time). */
export function defaultSession(now = new Date()): ProductionSession {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Africa/Nairobi' }).format(now));
  return hour < 12 ? 'Morning' : 'Evening';
}

/**
 * One row per animal: type the yields for a milking (or the day's eggs) and save them together.
 * Enter moves to the next animal. Values already saved show as recorded and can be corrected by
 * Owners and Managers.
 */
@Component({
  selector: 'app-production-sheet',
  imports: [DecimalPipe, FormsModule],
  styleUrls: ['./farm-module.css', './production.css', './farm-theme.css'],
  template: `<section class="sheet-card" aria-labelledby="sheet-title">
    <header class="sheet-head">
      <div>
        <h2 id="sheet-title">Daily production sheet</h2>
        <p>Enter each animal's yield for one session and save them all at once.</p>
      </div>
      <div class="sheet-controls">
        <label>Date<input type="date" name="sheetDate" [max]="today" [ngModel]="date()" (ngModelChange)="date.set($event)" /></label>
        <div class="field-group">
          <span>Measure</span>
          <div class="segmented" role="group" aria-label="Measure">
            @for (k of kinds; track k) {
              <button type="button" [class.active]="kind() === k" [attr.aria-pressed]="kind() === k" (click)="setKind(k)">{{ k }}</button>
            }
          </div>
        </div>
        <div class="field-group">
          <span>Session</span>
          <div class="segmented" role="group" aria-label="Session">
            @for (s of sessions; track s) {
              <button type="button" [class.active]="session() === s" [attr.aria-pressed]="session() === s" (click)="session.set(s)">
                <i class="session-dot" [style.background]="colors[s]" aria-hidden="true"></i>{{ s }}
              </button>
            }
          </div>
        </div>
      </div>
    </header>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (notice()) {
      <p class="settings-saved sheet-notice" role="status">{{ notice() }}</p>
    }
    @if (loading()) {
      <div class="sheet-skeleton" aria-busy="true">
        @for (r of [1, 2, 3, 4]; track r) {
          <span class="sk-block"></span>
        }
      </div>
    } @else if (!visible().length) {
      <p class="form-hint">
        {{ rows().length ? 'No active animals usually give ' + kind().toLowerCase() + '.' : 'Add an active livestock record before recording production.' }}
        @if (rows().length) {
          <button type="button" class="link-button" (click)="showAll.set(true)">Show all animals</button>
        }
      </p>
    } @else {
      <div class="sheet-table-wrap">
        <table class="sheet-table">
          <thead>
            <tr>
              <th scope="col">Animal or group</th>
              <th scope="col" class="optional">Species</th>
              <th scope="col" class="num optional">Last {{ session().toLowerCase() }}</th>
              <th scope="col" class="num">{{ kind() === 'Eggs' ? 'Eggs counted' : kind() + ' (' + unit() + ')' }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of visible(); track row.id) {
              <tr [class.recorded]="row.value !== null" [class.blocked]="!!row.blocked_by">
                <th scope="row">
                  {{ row.label }}
                  @if (row.value !== null) {
                    <span class="status-pill ok">Recorded</span>
                  } @else if (row.blocked_by) {
                    <span class="status-pill blocked" [title]="blockedReason(row)">{{ row.blocked_by.includes('Whole day') ? 'Whole day recorded' : 'Recorded by session' }}</span>
                  }
                </th>
                <td class="optional">{{ row.species }}</td>
                <td class="num muted optional">{{ row.last === null ? '—' : (row.last | number: '1.0-2') }}</td>
                <td class="num">
                  <input
                    class="sheet-input"
                    type="number"
                    [attr.inputmode]="kind() === 'Eggs' ? 'numeric' : 'decimal'"
                    min="0"
                    [step]="kind() === 'Eggs' ? 1 : 0.1"
                    [attr.aria-label]="kind() + ' for ' + row.label"
                    [placeholder]="row.last === null ? '' : (row.last | number: '1.0-2')"
                    [disabled]="!!row.blocked_by || (row.value !== null && !canCorrect())"
                    [ngModel]="draft()[row.id]"
                    (ngModelChange)="setValue(row.id, $event)"
                    (keydown.enter)="next($event)"
                  />
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <footer class="sheet-foot">
        <div class="sheet-total">
          <span>{{ filled() }} of {{ openCount() }} entered</span>
          <strong>{{ total() | number: '1.0-2' }} {{ unit() }}</strong>
        </div>
        <label class="archive-toggle"><input type="checkbox" [checked]="showAll()" (change)="showAll.set(!showAll())" /> Show all animals</label>
        <button type="button" (click)="copyLast()" [disabled]="busy()">Use last values</button>
        <button type="button" class="primary" (click)="save()" [disabled]="busy() || !changed()">Save sheet</button>
      </footer>
    }
  </section>`,
})
export class ProductionSheet {
  private readonly service = inject(FarmService);
  private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
  readonly farm = input<Farm | null>(null);
  readonly saved = output<void>();
  readonly kinds: ProductionKind[] = ['Milk', 'Eggs', 'Weight', 'Wool'];
  readonly sessions: ProductionSession[] = ['Morning', 'Midday', 'Evening', 'Whole day'];
  readonly colors = SESSION_COLORS;
  readonly today = nairobiToday();
  readonly date = signal(this.today);
  readonly kind = signal<ProductionKind>('Milk');
  readonly session = signal<ProductionSession>(defaultSession());
  readonly showAll = signal(false);
  readonly rows = signal<ProductionSheetRow[]>([]);
  /** Typed values by animal id; '' means left blank. */
  readonly draft = signal<Record<string, number | ''>>({});
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly unit = computed(() => PRODUCTION_UNITS[this.kind()]);
  readonly canCorrect = computed(() => farmCan.manageRecords(this.farm()?.role));
  readonly visible = computed(() => (this.showAll() ? this.rows() : this.rows().filter((r) => appliesTo(this.kind(), r))));
  readonly entries = computed(() =>
    this.visible()
      .map((r) => ({ row: r, value: this.draft()[r.id] }))
      .filter((e): e is { row: ProductionSheetRow; value: number } => !e.row.blocked_by && typeof e.value === 'number' && e.value > 0),
  );
  readonly filled = computed(() => this.entries().length);
  /** Animals that can take a value for this session (not blocked by whole day vs sessions). */
  readonly openCount = computed(() => this.visible().filter((r) => !r.blocked_by).length);
  readonly total = computed(() => this.entries().reduce((sum, e) => sum + e.value, 0));
  /** True when something new or different from what is saved has been typed. */
  readonly changed = computed(() => this.entries().some((e) => e.row.value !== e.value));

  constructor() {
    effect(() => {
      const farm = this.farm();
      const slot: ProductionSlot = { measured_on: this.date(), session: this.session(), kind: this.kind() };
      // untracked: load() reads rows(), which must not re-trigger this effect.
      if (farm && slot.measured_on) untracked(() => void this.load(farm.id, slot));
    });
  }

  setKind(kind: ProductionKind): void {
    this.kind.set(kind);
    // Milk is usually per milking; other measures default to one entry a day (still changeable).
    this.session.set(kind === 'Milk' ? defaultSession() : 'Whole day');
  }

  setValue(id: string, value: number | string | null): void {
    const n = value === '' || value === null ? '' : Number(value);
    this.draft.update((d) => ({ ...d, [id]: n === '' || Number.isNaN(n) ? '' : n }));
    this.notice.set('');
  }

  /** Why an animal cannot take this session: a day is one whole-day total or sessions, not both. */
  blockedReason(row: ProductionSheetRow): string {
    const by = row.blocked_by ?? [];
    return by.includes('Whole day')
      ? `A whole-day total is already recorded for ${row.label} on this date. Delete it to record by session.`
      : `${by.join(' and ')} already recorded for ${row.label} on this date, so a whole-day total cannot be added.`;
  }

  /** Fills blanks with each animal's previous value for this session. */
  copyLast(): void {
    this.draft.update((d) => {
      const next = { ...d };
      for (const r of this.visible()) if ((next[r.id] === '' || next[r.id] === undefined) && r.last !== null && r.value === null && !r.blocked_by) next[r.id] = r.last;
      return next;
    });
  }

  /** Enter moves to the next animal; on the last one it saves the sheet. */
  next(event: Event): void {
    event.preventDefault();
    const inputs = Array.from(this.host.nativeElement.querySelectorAll<HTMLInputElement>('.sheet-input:not([disabled])'));
    const target = inputs[inputs.indexOf(event.target as HTMLInputElement) + 1];
    if (target) {
      target.focus();
      target.select();
    } else void this.save();
  }

  async save(): Promise<void> {
    const farm = this.farm();
    if (!farm || this.busy() || !this.changed()) return;
    if (this.kind() === 'Eggs' && this.entries().some((e) => !Number.isInteger(e.value))) {
      this.error.set('Eggs are counted one by one. Enter whole numbers.');
      return;
    }
    const slot: ProductionSlot = { measured_on: this.date(), session: this.session(), kind: this.kind() };
    const entries = this.entries()
      .filter((e) => e.row.value !== e.value)
      .map((e) => ({ livestock_record_id: e.row.id, value: e.value }));
    this.busy.set(true);
    this.error.set('');
    try {
      const result = await this.service.saveProductionSheet(farm.id, slot, entries);
      this.notice.set(
        `Saved ${result.saved} ${result.saved === 1 ? 'entry' : 'entries'} (${result.total} ${result.unit})` +
          (result.corrected ? `, ${result.corrected} corrected.` : '.'),
      );
      await this.load(farm.id, slot, true);
      this.saved.emit();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async load(id: string, slot: ProductionSlot, keepNotice = false): Promise<void> {
    this.loading.set(!this.rows().length);
    this.error.set('');
    if (!keepNotice) this.notice.set('');
    try {
      const rows = await this.service.productionSheet(id, slot);
      if (slot.measured_on !== this.date() || slot.session !== this.session() || slot.kind !== this.kind()) return;
      this.rows.set(rows);
      this.draft.set(Object.fromEntries(rows.map((r) => [r.id, r.value ?? ''])));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
