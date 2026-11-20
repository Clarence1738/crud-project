import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { errorMessage } from './api.service';
import { DeliveryAnalytics as Metrics, TransportService } from './transport.service';

@Component({
  selector: 'app-delivery-analytics',
  imports: [DecimalPipe, PercentPipe],
  templateUrl: './delivery-analytics.html',
  styleUrl: './delivery-analytics.css',
})
export class DeliveryAnalytics {
  private readonly service = inject(TransportService);
  readonly revision = input.required<number>();
  readonly metrics = signal<Metrics | null>(null);
  readonly error = signal('');
  readonly rates = computed(() => {
    const report = this.metrics();
    if (!report) return [];

    return [
      {
        label: 'On-time delivery',
        rate: report.on_time.rate,
        count: report.on_time.count,
        total: report.on_time.eligible,
        unit: 'eligible deliveries',
        remainder: 'late',
        empty: 'No deliveries with both dates.',
        coverage: false,
      },
      {
        label: 'Promised ETA coverage',
        rate: report.on_time.baseline_coverage,
        count: report.on_time.eligible,
        total: report.delivered - report.on_time.missing_delivery_date,
        unit: 'dated deliveries',
        remainder: 'without a promised ETA',
        empty: 'No dated deliveries.',
        coverage: true,
      },
    ];
  });
  readonly transitRows = computed(() => {
    const transit = this.metrics()?.transit;
    if (!transit || transit.median_days === null || transit.p90_days === null) return [];

    return [
      { label: 'Median', days: transit.median_days },
      { label: '90th percentile', days: transit.p90_days },
    ];
  });
  readonly transitScaleDays = computed(() =>
    Math.max(1, Math.ceil(Math.max(...this.transitRows().map((row) => row.days)))),
  );
  private readonly retryCount = signal(0);

  constructor() {
    effect((onCleanup) => {
      this.revision();
      this.retryCount();
      let active = true;
      onCleanup(() => {
        active = false;
      });
      this.error.set('');
      void this.service.analytics().then(
        (metrics) => {
          if (active) this.metrics.set(metrics);
        },
        (error: unknown) => {
          if (active) this.error.set(errorMessage(error));
        },
      );
    });
  }

  retry(): void {
    this.retryCount.update((count) => count + 1);
  }
}
