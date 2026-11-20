import { DeferBlockBehavior, DeferBlockState, TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './auth.service';
import { Transports } from './transports';
import { TransportService } from './transport.service';
import { DocumentService } from './documents/document.service';
import { signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { RecordRevisionsService } from './record-revisions.service';

describe('Transport API integration', () => {
  const auth = {
    user: signal<string | null>(null),
    restore: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
  const service = { list: vi.fn(), save: vi.fn(), delete: vi.fn(), updateStatus: vi.fn() };
  const revisions = {
    register: signal<string | null>(null),
    transports: signal<string | null>(null),
    documents: signal<string | null>(null),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    // jsdom has no canvas encoder. DevExtreme checks for one when creating a chart.
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:,');
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    auth.user.set(null);
    revisions.register.set(null);
    revisions.transports.set(null);
    auth.restore.mockResolvedValue(undefined);
    service.list.mockResolvedValue({ data: [], current_page: 1, last_page: 1, total: 0 });
    await TestBed.configureTestingModule({
      deferBlockBehavior: DeferBlockBehavior.Manual,
      imports: [App, Transports],
      providers: [
        provideRouter(routes),
        { provide: AuthService, useValue: auth },
        { provide: TransportService, useValue: service },
        {
          provide: RecordRevisionsService,
          useValue: revisions,
        },

        {
          provide: DocumentService,
          useValue: {
            list: vi.fn().mockResolvedValue({ data: [], current_page: 1, last_page: 1 }),
          },
        },
      ],
    }).compileComponents();
  });

  it('refreshes the current register page and filter when database records change', async () => {
    auth.user.set('alice@example.com');
    const fixture = TestBed.createComponent(Transports);
    fixture.detectChanges();
    await fixture.whenStable();

    const register = fixture.componentInstance;
    register.appliedQuery.set('Nairobi');
    register.page.set(2);
    service.list.mockResolvedValue({ data: [], current_page: 2, last_page: 3, total: 105 });
    revisions.register.set('1:2026-11-20');
    revisions.transports.set('1');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(service.list).toHaveBeenLastCalledWith(2, {
      search: 'Nairobi', status: '', exception: '',
    });
    expect(register.total()).toBe(105);
    expect(register.calendarRevision()).toBe(1);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps failed edits open so the user can retry', async () => {
    const fixture = TestBed.createComponent(Transports);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    auth.user.set('alice@example.com');

    const app = fixture.componentInstance;
    app.openEditor();
    app.draft = {
      sender_company: 'Acme Export',
      recipient_company: 'Coastal Retail',
      origin: 'Nairobi',
      destination: 'Mombasa',
      vehicle: 'KDA 123A',
      date: '2026-11-19',
      expected_arrival_date: '2026-11-20',
      status: 'Scheduled',
    };
    service.save.mockRejectedValueOnce(new Error('Offline'));
    await app.save();
    expect(app.editorOpen()).toBe(true);
    expect(app.records()).toEqual([]);
    expect(app.notice()).toBeTruthy();
  });

  it('updates the displayed status only after the server confirms it', async () => {
    const fixture = TestBed.createComponent(Transports);
    fixture.detectChanges();
    await fixture.whenStable();
    auth.user.set('alice@example.com');

    const app = fixture.componentInstance;
    const record = {
      id: 'one',
      sender_company: 'Acme Export',
      recipient_company: 'Coastal Retail',
      origin: 'Nairobi',
      destination: 'Mombasa',
      vehicle: 'KDA 123A',
      date: '2026-11-19',
      expected_arrival_date: '2026-11-20',
      status: 'Scheduled' as const,
    };
    app.records.set([record]);
    app.openStatusEditor(record);
    app.statusDraft = 'Delivered';
    service.updateStatus.mockResolvedValueOnce({ ...record, status: 'Delivered' });
    service.list.mockResolvedValueOnce({
      data: [{ ...record, status: 'Delivered' }],
      current_page: 1,
      last_page: 1,
      total: 1,
    });
    await app.saveStatus();
    expect(service.updateStatus).toHaveBeenCalledWith('one', 'Delivered');
    expect(app.records()[0].status).toBe('Delivered');
    expect(app.delivered()).toBe(1);
    expect(app.statusEditor()).toBeNull();
  });

  it('preserves the old status and keeps the editor open if saving fails', async () => {
    const fixture = TestBed.createComponent(Transports);
    fixture.detectChanges();
    await fixture.whenStable();
    auth.user.set('alice@example.com');

    const app = fixture.componentInstance;
    const record = {
      id: 'one',
      sender_company: 'Acme Export',
      recipient_company: 'Coastal Retail',
      origin: 'Nairobi',
      destination: 'Mombasa',
      vehicle: 'KDA 123A',
      date: '2026-11-19',
      expected_arrival_date: '2026-11-20',
      status: 'Scheduled' as const,
    };
    app.records.set([record]);
    app.openStatusEditor(record);
    app.statusDraft = 'In transit';
    service.updateStatus.mockRejectedValueOnce(new Error('Offline'));
    await app.saveStatus();
    expect(app.records()[0].status).toBe('Scheduled');
    expect(app.statusEditor()).toEqual(record);
    expect(app.notice()).toBeTruthy();
  });
  it('shows the status form when the user clicks Change status and cancels it', async () => {
    const fixture = TestBed.createComponent(Transports);
    fixture.detectChanges();
    await fixture.whenStable();
    auth.user.set('alice@example.com');

    fixture.detectChanges();
    fixture.componentInstance.records.set([
      {
        id: 'one',
        sender_company: 'Acme Export',
        recipient_company: 'Coastal Retail',
        origin: 'Nairobi',
        destination: 'Mombasa',
        vehicle: 'KDA 123A',
        date: '2026-11-19',
        expected_arrival_date: '2026-11-20',
        status: 'Scheduled',
      },
    ]);
    fixture.detectChanges();
    const [workspace] = await fixture.getDeferBlocks();
    await workspace.render(DeferBlockState.Complete);
    const [grid] = await workspace.getDeferBlocks();
    await grid.render(DeferBlockState.Complete);
    await fixture.whenStable();
    const button = await vi.waitFor(() => {
      fixture.detectChanges();
      const action = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        'button[aria-label="Change status for Coastal Retail"]',
      );
      expect(action).toBeTruthy();
      return action!;
    });
    button.click();
    fixture.detectChanges();
    const form = await vi.waitFor(() => {
      fixture.detectChanges();
      const popupForm = document.querySelector<HTMLFormElement>(
        'form[aria-label="Change shipment status"]',
      );
      expect(popupForm).toBeTruthy();
      return popupForm!;
    });
    expect(form.closest('[role="dialog"]')).toBeTruthy();
    expect(form.querySelector('#shipment-status')).toBeTruthy();
    form.querySelector<HTMLElement>('[role="button"][aria-label="Cancel"]')!.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.statusEditor()).toBeNull();
    expect(document.querySelector('#shipment-status')).toBeNull();
  });
  it('creates a transport through the popup and deletes only after confirmation', async () => {
    const fixture = TestBed.createComponent(Transports);
    fixture.detectChanges();
    await fixture.whenStable();
    auth.user.set('alice@example.com');

    fixture.detectChanges();
    const [workspace] = await fixture.getDeferBlocks();
    await workspace.render(DeferBlockState.Complete);

    const draft = {
      sender_company: 'Acme Export',
      recipient_company: 'Coastal Retail',
      origin: 'Nairobi',
      destination: 'Mombasa',
      vehicle: 'KDA 123A',
      date: '2026-11-19',
      expected_arrival_date: '2026-11-20',
      status: 'Scheduled' as const,
    };
    const record = { id: 'one', ...draft };
    const app = fixture.componentInstance;
    const popupButton = (label: string) =>
      vi.waitFor(() => {
        fixture.detectChanges();
        const button = document.querySelector<HTMLElement>(
          `[role="dialog"] [role="button"][aria-label="${label}"]`,
        );
        expect(button).toBeTruthy();
        return button!;
      });

    app.openEditor();
    app.draft = draft;
    service.save.mockResolvedValue(record);
    const create = await popupButton('Create transport');
    await fixture.whenStable();
    fixture.detectChanges();
    create.click();
    await vi.waitFor(() => expect(service.save).toHaveBeenCalledWith(draft, null));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(app.editorOpen()).toBe(false);

    app.confirmDelete(record);
    (await popupButton('Keep record')).click();
    fixture.detectChanges();
    expect(app.pendingDelete()).toBeNull();
    expect(service.delete).not.toHaveBeenCalled();

    app.confirmDelete(record);
    service.delete.mockResolvedValue(undefined);
    (await popupButton('Delete transport')).click();
    await vi.waitFor(() => expect(service.delete).toHaveBeenCalledWith('one'));
    await fixture.whenStable();
    expect(app.pendingDelete()).toBeNull();
  });

  it('opens the transport workspace for a signed-in user', async () => {
    auth.user.set('alice@example.com');
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await TestBed.inject(Router).navigateByUrl('/');
    const [workspace] = await fixture.getDeferBlocks();
    await workspace.render(DeferBlockState.Complete);
    await fixture.whenStable();
    const [dashboard] = await workspace.getDeferBlocks();
    await dashboard.render(DeferBlockState.Complete);
    expect(fixture.nativeElement.querySelector('app-transports h1')?.textContent).toContain(
      'Transport records',
    );
    expect(service.list).toHaveBeenCalledWith(1);
  });

  it('does not load the transport workspace for a guest', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(service.list).not.toHaveBeenCalled();
    expect(service.save).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#login-title')).toBeTruthy();
  });
});
