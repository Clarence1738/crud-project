import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DxPieChartComponent } from 'devextreme-angular/ui/pie-chart';
import { errorMessage } from './api.service';
import { DeliveryAnalytics, TransportRecord, TransportService } from './transport.service';

@Component({
  selector: 'app-dashboard',
  imports: [DecimalPipe, PercentPipe, DxPieChartComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit {
  private readonly service = inject(TransportService);
  private readonly router = inject(Router);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly records = signal<TransportRecord[]>([]);
  readonly total = signal(0);
  readonly exceptions = signal({ due_today: 0, overdue: 0, missing_eta: 0 });
  readonly analytics = signal<DeliveryAnalytics | null>(null);
  readonly statusData = computed(() =>
    ['Scheduled', 'In transit', 'Delivered'].map((status) => ({
      status,
      count: this.records().filter((record) => record.status === status).length,
    })),
  );
  readonly recent = computed(() => this.records().slice(0, 5));
  readonly palette = ['#d49a38', '#3d7dd8', '#23936f'];

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const [page, analytics] = await Promise.all([this.service.list(1), this.service.analytics()]);
      this.records.set(page.data);
      this.total.set(page.total);
      this.exceptions.set(page.exceptions ?? this.exceptions());
      this.analytics.set(analytics);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  openShipments(): void {
    void this.router.navigateByUrl('/');
  }

  openShipment(id: string): void {
    void this.router.navigate(['/shipments', id]);
  }
}
