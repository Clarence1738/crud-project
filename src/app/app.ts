import { afterNextRender, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxTemplateDirective } from 'devextreme-angular/core';
import { DxButtonComponent } from 'devextreme-angular/ui/button';
import { DxPopupComponent } from 'devextreme-angular/ui/popup';
import { DxSelectBoxComponent } from 'devextreme-angular/ui/select-box';
import { DxTextBoxComponent } from 'devextreme-angular/ui/text-box';
import { AuthService } from './auth.service';
import { errorMessage } from './api.service';
import { Documents } from './documents/documents';
import { emptyRecord, Status, TransportRecord, TransportService } from './transport.service';

@Component({
  selector: 'app-root',
  imports: [
    FormsModule,
    Documents,
    DxDataGridComponent,
    DxiDataGridColumnComponent,
    DxTemplateDirective,
    DxButtonComponent,
    DxPopupComponent,
    DxSelectBoxComponent,
    DxTextBoxComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly auth = inject(AuthService);
  private readonly service = inject(TransportService);
  readonly loginError = signal('');
  email = '';
  password = '';
  name = '';
  confirmation = '';
  registering = false;
  readonly records = signal<TransportRecord[]>([]);
  readonly ready = signal(false);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly query = signal('');
  readonly statusFilter = signal('');
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly pendingDelete = signal<TransportRecord | null>(null);
  readonly selected = signal<TransportRecord | null>(null);
  readonly statuses: Status[] = ['Scheduled', 'In transit', 'Delivered'];
  readonly statusEditor = signal<TransportRecord | null>(null);
  statusDraft: Status = 'Scheduled';
  draft = emptyRecord();
  readonly filtered = computed(() => {
    const query = this.query().trim().toLowerCase();
    return this.records().filter(
      (record) =>
        (!this.statusFilter() || record.status === this.statusFilter()) &&
        [record.customer, record.origin, record.destination, record.vehicle, record.id].some(
          (value) => value.toLowerCase().includes(query),
        ),
    );
  });
  readonly inTransit = computed(
    () => this.records().filter((r) => r.status === 'In transit').length,
  );
  readonly delivered = computed(
    () => this.records().filter((r) => r.status === 'Delivered').length,
  );

  constructor() {
    effect(() => {
      if (!this.auth.user()) this.clearWorkspace();
    });
    afterNextRender(() => {
      void this.initialize();
    });
  }

  private async initialize(): Promise<void> {
    try {
      await this.auth.restore();
      if (this.auth.user()) await this.loadRecords();
    } catch (error) {
      this.loginError.set(errorMessage(error));
    } finally {
      this.ready.set(true);
    }
  }

  async loadRecords(page = 1): Promise<void> {
    this.busy.set(true);
    try {
      const response = await this.service.list(page);
      if (!this.auth.user()) return;
      this.records.set(response.data);
      this.page.set(response.current_page);
      this.lastPage.set(response.last_page);
    } catch (error) {
      this.notice.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  async login(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    this.loginError.set('');
    try {
      if (this.registering)
        await this.auth.register(this.name, this.email, this.password, this.confirmation);
      else await this.auth.login(this.email, this.password);
      await this.loadRecords();
    } catch (error) {
      this.loginError.set(errorMessage(error));
    } finally {
      this.password = '';
      this.confirmation = '';
      this.busy.set(false);
    }
  }

  async logout(): Promise<void> {
    this.busy.set(true);
    try {
      await this.auth.logout();
      this.clearWorkspace();
      this.email = '';
    } catch (error) {
      this.notice.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  private clearWorkspace(): void {
    this.records.set([]);
    this.statusEditor.set(null);
    this.editorOpen.set(false);
    this.selected.set(null);
    this.pendingDelete.set(null);
    this.editingId.set(null);
    this.draft = emptyRecord();
    this.query.set('');
    this.statusFilter.set('');
    this.notice.set('');
    this.page.set(1);
    this.lastPage.set(1);
  }

  openEditor(record?: TransportRecord): void {
    if (!this.auth.user() || this.busy()) return;
    this.selected.set(null);
    this.editingId.set(record?.id ?? null);
    this.draft = record
      ? {
          customer: record.customer,
          origin: record.origin,
          destination: record.destination,
          vehicle: record.vehicle,
          date: record.date,
          status: record.status,
        }
      : emptyRecord();
    this.editorOpen.set(true);
    this.notice.set('');
  }

  async save(): Promise<void> {
    if (!this.auth.user() || this.busy()) return;
    this.busy.set(true);
    this.notice.set('');
    try {
      await this.service.save(this.draft, this.editingId());
      this.editorOpen.set(false);
      await this.loadRecords();
      this.notice.set('Transport record saved.');
    } catch (error) {
      this.notice.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  openStatusEditor(record: TransportRecord): void {
    if (!this.auth.user() || this.busy()) return;
    this.statusDraft = record.status;
    this.statusEditor.set(record);
    this.notice.set('');
  }

  async saveStatus(): Promise<void> {
    const record = this.statusEditor();
    if (!this.auth.user() || !record || this.busy()) return;
    this.busy.set(true);
    this.notice.set('');
    try {
      const updated = await this.service.updateStatus(record.id, this.statusDraft);
      if (!this.auth.user()) return;
      this.records.update((records) =>
        records.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (this.selected()?.id === updated.id) this.selected.set(updated);
      this.statusEditor.set(null);
      this.notice.set('Shipment status updated to ' + updated.status + '.');
    } catch (error) {
      this.notice.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  confirmDelete(record: TransportRecord): void {
    if (!this.auth.user() || this.busy()) return;
    this.notice.set('');
    this.pendingDelete.set(record);
  }

  async deleteRecord(): Promise<void> {
    const record = this.pendingDelete();
    if (!this.auth.user() || !record || this.busy()) return;
    this.busy.set(true);
    try {
      await this.service.delete(record.id);
      this.pendingDelete.set(null);
      this.selected.set(null);
      await this.loadRecords();
      this.notice.set('Transport record deleted.');
    } catch (error) {
      this.notice.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
