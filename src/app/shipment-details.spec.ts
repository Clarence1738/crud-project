import { signal } from '@angular/core';
import { DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RecordRevisionsService } from './record-revisions.service';
import { ShipmentDetails } from './shipment-details';
import { TransportDetails, TransportService } from './transport.service';

it('shows the automatic delivery date and transit days without a time entry form', async () => {
  const shipment: TransportDetails = {
    id: 'shipment',
    sender_company: 'Sender',
    recipient_company: 'Recipient',
    origin: 'Nairobi',
    destination: 'Mombasa',
    vehicle: 'KDA 123A',
    date: '2026-11-20',
    expected_arrival_date: null,
    status: 'Delivered',
    delivered_at: '2026-11-20T09:30:45Z',
    transit_days: 0,
    history: [],
  };
  await TestBed.configureTestingModule({
    deferBlockBehavior: DeferBlockBehavior.Manual,
    imports: [ShipmentDetails],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(convertToParamMap({ id: shipment.id })) },
      },
      { provide: RecordRevisionsService, useValue: { register: signal(null) } },
      {
        provide: TransportService,
        useValue: { details: vi.fn().mockResolvedValue(shipment) },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ShipmentDetails);
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  expect(root.textContent).toContain('Nov 20, 2026');
  expect(root.textContent).toMatch(/Transit days\s*0/);
  expect(root.querySelector('input[type=time]')).toBeNull();
}, 30_000);
