import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxTemplateDirective } from 'devextreme-angular/core';
import { errorMessage } from './api.service';
import { AuthService } from './auth.service';
import { AdminUser, FarmService } from './farm.service';
import { Skeleton } from './skeleton';

/**
 * System Administrator screen: review accounts and suspend or reactivate them.
 * Administrators manage accounts only and see no farm records or finance.
 */
@Component({
  selector: 'app-farm-admin',
  imports: [DatePipe, DxDataGridComponent, DxiDataGridColumnComponent, DxTemplateDirective, Skeleton],
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
        <h1>System administration</h1>
        <p>
          Review user accounts and suspend or reactivate access. Suspended accounts are signed out
          and cannot sign in.
        </p>
      </div>
    </header>
    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (!auth.isAdmin()) {
      <section class="grid-card access-note">
        <h2>System Administrators only</h2>
        <p>Your account does not have the System Administrator role.</p>
      </section>
    } @else if (loading()) {
      <app-skeleton [columns]="7" label="Loading accounts…" />
    } @else {
      <section class="grid-card">
        <dx-data-grid
          [dataSource]="users()"
          keyExpr="id"
          [rowAlternationEnabled]="true"
          [columnAutoWidth]="true"
          [filterRow]="{ visible: true }"
          [headerFilter]="{ visible: true }"
          [showBorders]="false"
        >
          <dxi-data-grid-column dataField="name" caption="Name" />
          <dxi-data-grid-column dataField="email" caption="Email" />
          <dxi-data-grid-column dataField="role" caption="Role" />
          <dxi-data-grid-column dataField="farms" caption="Farms" />
          <dxi-data-grid-column
            dataField="last_login_at"
            caption="Last sign in"
            cellTemplate="dateCell"
          />
          <dxi-data-grid-column dataField="status" caption="Status" cellTemplate="statusCell" />
          <dxi-data-grid-column
            caption="Actions"
            cellTemplate="actionCell"
            [allowFiltering]="false"
            [allowSorting]="false"
          />
          <div *dxTemplate="let cell of 'dateCell'">
            {{ cell.value ? (cell.value | date: 'd MMM y, HH:mm') : 'Never' }}
          </div>
          <div *dxTemplate="let cell of 'statusCell'">
            <span
              class="status-pill"
              [class.working]="cell.value === 'Active'"
              [class.preview]="cell.value !== 'Active'"
              >{{ cell.value }}</span
            >
          </div>
          <div *dxTemplate="let cell of 'actionCell'">
            @if (cell.data.id !== auth.userId() && cell.data.role !== 'System Administrator') {
              <button
                type="button"
                class="edit-action"
                [disabled]="busy()"
                (click)="toggle(cell.data)"
              >
                {{ cell.data.status === 'Active' ? 'Suspend' : 'Reactivate' }}
              </button>
            }
          </div>
        </dx-data-grid>
      </section>
    }
  </section>`,
})
export class FarmAdmin implements OnInit {
  readonly auth = inject(AuthService);
  private readonly service = inject(FarmService);
  readonly users = signal<AdminUser[]>([]);
  readonly busy = signal(false);
  readonly loading = signal(true);
  readonly error = signal('');

  async ngOnInit(): Promise<void> {
    if (!this.auth.isAdmin()) return;
    try {
      this.users.set(await this.service.adminUsers());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  async toggle(user: AdminUser): Promise<void> {
    const status = user.status === 'Active' ? 'Suspended' : 'Active';
    if (
      status === 'Suspended' &&
      !confirm(
        `Suspend ${user.name}? They will be signed out and unable to sign in until reactivated.`,
      )
    )
      return;
    this.busy.set(true);
    this.error.set('');
    try {
      const updated = await this.service.setUserStatus(user.id, status);
      this.users.update((users) => users.map((u) => (u.id === updated.id ? updated : u)));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
