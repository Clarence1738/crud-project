import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DxSchedulerComponent, DxSchedulerTypes } from 'devextreme-angular/ui/scheduler';
import { AuthService } from './auth.service';
import { errorMessage } from './api.service';
import { TransportService } from './transport.service';

const dateKey = (date: Date): string =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
@Component({
  selector: 'app-arrival-calendar',
  imports: [DxSchedulerComponent],
  templateUrl: './arrival-calendar.html',
  styleUrls: ['./app.css', './arrival-calendar.css'],
})
export class ArrivalCalendar {
  private readonly auth = inject(AuthService);
  private readonly service = inject(TransportService);
  readonly revision = input.required<number>();
  readonly openShipment = output<string>();
  readonly calendarDate = signal(new Date());
  readonly calendarEvents = signal<
    { id: string; text: string; startDate: Date; endDate: Date; allDay: boolean }[]
  >([]);
  readonly calendarMessage = signal('');
  private calendarRequest = 0;
  constructor() {
    effect(() => {
      this.revision();
      void this.loadCalendar(this.calendarDate());
    });
  }

  changeCalendarDate(value: Date | number | string): void {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || dateKey(date) === dateKey(this.calendarDate())) return;
    this.calendarDate.set(date);
  }

  openCalendarShipment(event: DxSchedulerTypes.AppointmentClickEvent): void {
    event.cancel = true;
    const id = event.appointmentData['id'];
    if (typeof id === 'string') this.openShipment.emit(id);
  }

  private async loadCalendar(date: Date): Promise<void> {
    const request = ++this.calendarRequest;
    const year = date.getFullYear();
    const month = date.getMonth();
    this.calendarMessage.set('Loading arrivals…');
    try {
      const records = await this.service.calendar(
        dateKey(new Date(year, month, -6)),
        dateKey(new Date(year, month + 1, 14)),
      );
      if (request !== this.calendarRequest || !this.auth.user()) return;
      this.calendarEvents.set(
        records.map((record) => {
          const [year, month, day] = record.expected_arrival_date.split('-').map(Number);
          return {
            id: record.id,
            text: [record.reference, record.recipient_company, record.status]
              .filter(Boolean)
              .join(' · '),
            startDate: new Date(year, month - 1, day),
            endDate: new Date(year, month - 1, day + 1),
            allDay: true,
          };
        }),
      );
      this.calendarMessage.set(records.length ? '' : 'No expected arrivals in this date range.');
    } catch (error) {
      if (request === this.calendarRequest) {
        this.calendarEvents.set([]);
        this.calendarMessage.set(errorMessage(error));
      }
    }
  }
}
