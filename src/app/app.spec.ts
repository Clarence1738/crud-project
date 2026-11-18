import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { AuthService } from './auth.service';
import { TransportService } from './transport.service';
import { DocumentService } from './documents/document.service';
import { signal } from '@angular/core';

describe('Transport API integration', () => {
  const auth = {
    user: signal<string | null>(null),
    restore: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  };
  const service = { list: vi.fn(), save: vi.fn(), delete: vi.fn(), updateStatus: vi.fn() };

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.user.set(null);
    auth.restore.mockResolvedValue(undefined);
    service.list.mockResolvedValue({ data: [], current_page: 1, last_page: 1, total: 0 });
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: TransportService, useValue: service },
        {
          provide: DocumentService,
          useValue: {
            list: vi.fn().mockResolvedValue({ data: [], current_page: 1, last_page: 1 }),
          },
        },
      ],
    }).compileComponents();
  });

  it('keeps failed edits open so the user can retry', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    auth.user.set('alice@example.com');
    const app = fixture.componentInstance;
    app.openEditor();
    app.draft = {
      customer: 'Acme',
      origin: 'Nairobi',
      destination: 'Mombasa',
      vehicle: 'KDA',
      date: '2026-11-18',
      status: 'Scheduled',
    };
    service.save.mockRejectedValueOnce(new Error('Offline'));
    await app.save();
    expect(app.editorOpen()).toBe(true);
    expect(app.records()).toEqual([]);
    expect(app.notice()).toBeTruthy();
  });

  it('updates the displayed status only after the server confirms it', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    auth.user.set('alice@example.com');
    const app = fixture.componentInstance;
    const record = {
      id: 'one',
      customer: 'Acme',
      origin: 'Nairobi',
      destination: 'Mombasa',
      vehicle: 'KDA',
      date: '2026-11-18',
      status: 'Scheduled' as const,
    };
    app.records.set([record]);
    app.openStatusEditor(record);
    app.statusDraft = 'Delivered';
    service.updateStatus.mockResolvedValueOnce({ ...record, status: 'Delivered' });
    await app.saveStatus();
    expect(service.updateStatus).toHaveBeenCalledWith('one', 'Delivered');
    expect(app.records()[0].status).toBe('Delivered');
    expect(app.delivered()).toBe(1);
    expect(app.statusEditor()).toBeNull();
  });

  it('preserves the old status and keeps the editor open if saving fails', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    auth.user.set('alice@example.com');
    const app = fixture.componentInstance;
    const record = {
      id: 'one',
      customer: 'Acme',
      origin: 'Nairobi',
      destination: 'Mombasa',
      vehicle: 'KDA',
      date: '2026-11-18',
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
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    auth.user.set('alice@example.com');
    fixture.detectChanges();
    fixture.componentInstance.records.set([
      {
        id: 'one',
        customer: 'Acme',
        origin: 'Nairobi',
        destination: 'Mombasa',
        vehicle: 'KDA',
        date: '2026-11-18',
        status: 'Scheduled',
      },
    ]);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      'button[aria-label="Change status for Acme"]',
    ) as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    fixture.detectChanges();
    const form = fixture.nativeElement.querySelector(
      'form[aria-label="Change shipment status"]',
    ) as HTMLFormElement;
    expect(form).toBeTruthy();
    expect(form.querySelectorAll('option')).toHaveLength(3);
    expect(fixture.nativeElement.textContent).not.toContain('Stored privately on the server');
    (form.querySelector('button[type="button"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#shipment-status')).toBeNull();
  });
  it('blocks mutations when logged out', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.componentInstance.save();
    await fixture.componentInstance.deleteRecord();
    expect(service.save).not.toHaveBeenCalled();
    expect(service.delete).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#login-title')).toBeTruthy();
  });
});
