import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from './api.service';
import { Farm, farmCan, FarmService, FarmSettings as Settings } from './farm.service';
import { Skeleton } from './skeleton';

const DEFAULTS: Settings = {
  reminder_days: 7,
  manager_finance_access: false,
  season_start_month: 'March',
  currency: 'KES',
  timezone: 'Africa/Nairobi',
};

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Per farm options. Every member can read them; only the owner can change them. */
@Component({
  selector: 'app-farm-settings',
  imports: [FormsModule, Skeleton],
  styleUrls: [
    './farm-module.css',
    './farm-fluid.css',
    './farm-collab.css',
    './farm-preview.css',
    './farm-theme.css',
  ],
  template: ` <section class="module-page">
    <header class="module-head">
      <div>
        <h1>Farm settings</h1>
        <p>Reminder window, finance access and regional defaults for the active farm.</p>
      </div>
      <div class="module-actions">
        <label
          >Active farm<select [ngModel]="farm()?.id || ''" (ngModelChange)="selectFarm($event)">
            @for (item of farms(); track item.id) {
              <option [value]="item.id">{{ item.name }} · {{ item.role }}</option>
            }
          </select></label
        >
      </div>
    </header>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (loading()) {
      <app-skeleton variant="form" [count]="5" label="Loading farm settings…" />
    } @else if (farm(); as f) {
      <section class="settings-card">
        <form (ngSubmit)="save()">
          <label
            >Reminder window (days)<input
              type="number"
              name="reminderDays"
              min="1"
              max="60"
              [(ngModel)]="draft.reminder_days"
              required
              [disabled]="!canEdit()"
          /></label>
          <label
            >Managers can see finance<select
              name="financeAccess"
              [(ngModel)]="draft.manager_finance_access"
              [disabled]="!canEdit()"
            >
              <option [ngValue]="false">No</option>
              <option [ngValue]="true">Yes</option>
            </select></label
          >
          <label
            >Season start month<select
              name="seasonStart"
              [(ngModel)]="draft.season_start_month"
              [disabled]="!canEdit()"
            >
              @for (month of months; track month) {
                <option>{{ month }}</option>
              }
            </select></label
          >
          <label>Currency<input name="currency" [ngModel]="draft.currency" disabled /></label>
          <label class="wide"
            >Time zone<input name="timezone" [ngModel]="draft.timezone" disabled
          /></label>
          <p class="wide form-hint">
            The reminder window sets how far ahead the dashboard shows health, maintenance and other
            reminders. Finance access lets Managers see and record income and expenses.
          </p>
          @if (canEdit()) {
            <div class="actions">
              @if (saved()) {
                <span class="settings-saved" role="status">Settings saved.</span>
              }
              <button class="primary" [disabled]="busy()">Save settings</button>
            </div>
          } @else {
            <p class="wide form-hint">
              Your role on {{ f.name }} is {{ f.role }}. Only the farm owner can change settings.
            </p>
          }
        </form>
      </section>
    }
  </section>`,
})
export class FarmSettings implements OnInit {
  private readonly service = inject(FarmService);
  readonly months = MONTHS;
  readonly farms = signal<Farm[]>([]);
  readonly farm = signal<Farm | null>(null);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly busy = signal(false);
  readonly loading = signal(true);
  readonly canEdit = computed(() => farmCan.manageFarm(this.farm()?.role));
  draft: Settings = { ...DEFAULTS };

  async ngOnInit(): Promise<void> {
    try {
      const farms = await this.service.farms();
      this.farms.set(farms);
      const farm = this.service.pickFarm(farms);
      if (farm) await this.selectFarm(farm.id);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async selectFarm(id: string): Promise<void> {
    const farm = this.farms().find((f) => f.id === id) ?? null;
    this.farm.set(farm);
    this.saved.set(false);
    this.error.set('');
    if (!farm) return;
    this.service.selectFarm(id);
    this.loading.set(true);
    try {
      this.draft = { ...DEFAULTS, ...(await this.service.settings(id)) };
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const farm = this.farm();
    if (!farm || !this.canEdit() || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.saved.set(false);
    try {
      this.draft = await this.service.updateSettings(farm.id, {
        reminder_days: Math.round(Number(this.draft.reminder_days)),
        manager_finance_access: this.draft.manager_finance_access,
        season_start_month: this.draft.season_start_month,
      });
      this.saved.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
