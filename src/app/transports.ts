import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterOutlet } from '@angular/router';
import { ArrivalCalendar } from './arrival-calendar';
import { DeliveryAnalytics } from './delivery-analytics';
import { ShipmentEditor } from './shipment-editor';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxTemplateDirective } from 'devextreme-angular/core';
import { DxButtonComponent } from 'devextreme-angular/ui/button';
import { DxPieChartComponent } from 'devextreme-angular/ui/pie-chart';
import { DxPopupComponent } from 'devextreme-angular/ui/popup';
import { DxSelectBoxComponent } from 'devextreme-angular/ui/select-box';
import { AuthService } from './auth.service';
import { errorMessage } from './api.service';
import { RecordRevisionsService } from './record-revisions.service';
import {
  DeliveryException,
  emptyRecord,
  Status,
  TransportRecord,
  TransportService,
} from './transport.service';

@Component({
  selector: 'app-transports',
  imports: [
    FormsModule,
    RouterOutlet,
    ArrivalCalendar,
    DeliveryAnalytics,
    ShipmentEditor,
    DxDataGridComponent,
    DxiDataGridColumnComponent,
    DxTemplateDirective,
    DxButtonComponent,
    DxPieChartComponent,
    DxPopupComponent,
    DxSelectBoxComponent,
  ],
  templateUrl: './transports.html',
  styleUrl: './app.css',
})
export class Transports implements OnInit {
  readonly auth = inject(AuthService);
  private readonly service = inject(TransportService);
  readonly records = signal<TransportRecord[]>([]);
  readonly busy = signal(false);
  readonly notice = signal('');
  readonly page = signal(1);
  readonly lastPage = signal(1);
  readonly total = signal(0);
  readonly query = signal('');
  readonly appliedQuery = signal('');
  readonly statusFilter = signal<Status | ''>('');
  readonly exceptionFilter = signal<DeliveryException | ''>('');
  readonly exceptions = signal<Record<DeliveryException, number>>({
    due_today: 0,
    overdue: 0,
    missing_eta: 0,
  });
  readonly exceptionOptions: { key: DeliveryException; label: string }[] = [
    { key: 'due_today', label: 'Due today' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'missing_eta', label: 'Missing ETA' },
  ];
  readonly openPanel = signal<'calendar' | 'analytics' | null>(null);
  readonly calendarRevision = signal(0);
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly pendingDelete = signal<TransportRecord | null>(null);
  readonly detailsOpen = signal(false);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly registerTitle = viewChild<ElementRef<HTMLHeadingElement>>('registerTitle');
  readonly statuses: Status[] = ['Scheduled', 'In transit', 'Delivered'];
  readonly statusEditor = signal<TransportRecord | null>(null);
  statusDraft: Status = 'Scheduled';
  draft = emptyRecord();
  readonly inTransit = computed(
    () => this.records().filter((r) => r.status === 'In transit').length,
  );
  readonly delivered = computed(
    () => this.records().filter((r) => r.status === 'Delivered').length,
  );
  readonly statusPalette = ['#a87126', '#3d6ea0', '#247557'];
  readonly statusCounts = computed(() => [
    { status: 'Scheduled', count: this.records().length - this.inTransit() - this.delivered() },
    { status: 'In transit', count: this.inTransit() },
    { status: 'Delivered', count: this.delivered() },
  ]);

  constructor() {
    const revisions = inject(RecordRevisionsService);
    let seen: string | null = null;
    let calendarSeen: string | null = null;
    effect(() => {
      const revision = revisions.register();
      const calendar = revisions.transports();
      if (this.busy() || revision === null || revision === seen) return;
      seen = revision;
      if (calendar !== calendarSeen) {
        calendarSeen = calendar;
        this.calendarRevision.update((value) => value + 1);
      }
      untracked(() => void this.loadRecords(this.page(), true));
    });
  }

  ngOnInit(): void {
    void this.loadRecords();
  }

  private listRequest = 0;

  async loadRecords(page = 1, background = false): Promise<void> {
    const request = ++this.listRequest;
    if (!background) this.busy.set(true);
    try {
      const filters = {
        search: this.appliedQuery(),
        status: this.statusFilter(),
        exception: this.exceptionFilter(),
      };
      const response =
        filters.search || filters.status || filters.exception
          ? await this.service.list(page, filters)
          : await this.service.list(page);
      if (request !== this.listRequest || !this.auth.user()) return;
      if (page > response.last_page && response.last_page > 0) {
        await this.loadRecords(response.last_page, background);
        return;
      }
      this.records.set(response.data);
      this.page.set(response.current_page);
      this.lastPage.set(response.last_page);
      this.total.set(response.total);
      if (response.exceptions) this.exceptions.set(response.exceptions);
    } catch (error) {
      if (!background && request === this.listRequest) this.notice.set(errorMessage(error));
    } finally {
      if (!background && request === this.listRequest) this.busy.set(false);
    }
  }

  search(): void {
    if (this.busy()) return;
    this.appliedQuery.set(this.query().trim());
    void this.loadRecords();
  }

  changeStatusFilter(status: Status | ''): void {
    if (this.busy()) return;
    this.statusFilter.set(status);
    void this.loadRecords();
  }

  filterException(exception: DeliveryException): void {
    if (this.busy()) return;
    const next = this.exceptionFilter() === exception ? '' : exception;
    this.exceptionFilter.set(next);
    if (next) {
      this.query.set('');
      this.appliedQuery.set('');
      this.statusFilter.set('');
    }
    void this.loadRecords();
  }

  showDetails(id: string): void {
    void this.router.navigate(['/shipments', id]);
  }

  returnToRegister(): void {
    this.detailsOpen.set(false);
    afterNextRender(() => this.registerTitle()?.nativeElement.focus(), { injector: this.injector });
  }

  openCalendarShipment(id: string): void {
    this.openPanel.set(null);
    this.showDetails(id);
  }

  openEditor(record?: TransportRecord): void {
    if (!this.auth.user() || this.busy()) return;
    this.editingId.set(record?.id ?? null);
    this.draft = record
      ? {
          sender_company: record.sender_company ?? '',
          recipient_company: record.recipient_company,
          origin: record.origin,
          destination: record.destination,
          vehicle: record.vehicle,
          driver_name: record.driver_name ?? '',
          driver_phone: record.driver_phone ?? '',
          date: record.date,
          expected_arrival_date: record.expected_arrival_date ?? '',
          reference: record.reference ?? '',
          goods_description: record.goods_description ?? '',
          quantity: record.quantity ?? null,
          notes: record.notes ?? '',
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
      this.calendarRevision.update((revision) => revision + 1);
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
      this.statusEditor.set(null);
      this.notice.set('Shipment status updated to ' + updated.status + '.');
      await this.loadRecords(this.page());
      this.calendarRevision.update((revision) => revision + 1);
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
      await this.loadRecords();
      this.calendarRevision.update((revision) => revision + 1);
      this.notice.set('Transport record archived.');
    } catch (error) {
      this.notice.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
