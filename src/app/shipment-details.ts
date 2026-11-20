import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  Component,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { errorMessage } from './api.service';
import { Documents } from './documents/documents';
import { HttpErrorResponse } from '@angular/common/http';
import { RecordRevisionsService } from './record-revisions.service';
import { TransportDetails, TransportService } from './transport.service';

@Component({
  selector: 'app-shipment-details',
  imports: [DatePipe, RouterLink, Documents],
  templateUrl: './shipment-details.html',
  styleUrls: ['./app.css', './shipment-details.css'],
})
export class ShipmentDetails {
  private readonly service = inject(TransportService);
  private readonly injector = inject(Injector);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap);
  private readonly detailTitle = viewChild<ElementRef<HTMLHeadingElement>>('detailTitle');
  readonly record = signal<TransportDetails | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    const revisions = inject(RecordRevisionsService);
    let previousId: string | null = null;
    effect((onCleanup) => {
      const id = this.params()?.get('id');
      if (!id) return;
      revisions.register();
      const navigating = id !== previousId;
      previousId = id;
      let active = true;
      onCleanup(() => {
        active = false;
      });
      if (navigating) {
        this.record.set(null);
        this.error.set('');
        this.loading.set(true);
      }
      void this.service.details(id).then(
        (record) => {
          if (!active) return;
          this.record.set(record);
          this.error.set('');
          this.loading.set(false);
          if (navigating) {
            afterNextRender(() => this.detailTitle()?.nativeElement.focus(), {
              injector: this.injector,
            });
          }
        },
        (error: unknown) => {
          if (!active) return;
          if (!navigating && !(error instanceof HttpErrorResponse && error.status === 404)) return;
          this.record.set(null);
          this.error.set(errorMessage(error));
          this.loading.set(false);
        },
      );
    });
  }
}
