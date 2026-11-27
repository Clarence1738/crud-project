import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input } from '@angular/core';

/**
 * Loading placeholder shaped like the content it stands in for, so pages do not jump when
 * data arrives. Variants: a data grid, a row of cards, a form, or a report (figures, chart, grid).
 */
@Component({
  selector: 'app-skeleton',
  template: `
    <div [class]="'skeleton is-' + variant()" aria-busy="true">
      <span class="sr-only" role="status">{{ label() }}</span>
      @switch (variant()) {
        @case ('table') {
          <ng-container *ngTemplateOutlet="table" />
        }
        @case ('lines') {
          <div class="lines">
            @for (r of rowList(); track r) {
              <div class="sk-row">
                @for (c of columnList(); track c) {
                  <i class="sk line" [style.width.%]="widths[(r + c) % widths.length]"></i>
                }
              </div>
            }
          </div>
        }
        @case ('cards') {
          <div class="sk-grid cards">
            @for (n of countList(); track n) {
              <div class="sk-card card">
                <div class="sk-head"><i class="sk icon"></i><i class="sk pill"></i></div>
                <i class="sk line lg w-60"></i><i class="sk line w-40"></i>
                <div class="sk-split"><i class="sk line w-70"></i><i class="sk line w-50"></i></div>
                <div class="sk-actions"><i class="sk button"></i><i class="sk button"></i></div>
              </div>
            }
          </div>
        }
        @case ('form') {
          <div class="sk-card form">
            @for (n of countList(); track n) {
              <div class="field"><i class="sk line sm w-30"></i><i class="sk input"></i></div>
            }
            <i class="sk button primary"></i>
          </div>
        }
        @case ('report') {
          <div class="sk-grid figures">
            @for (n of [1, 2, 3, 4]; track n) {
              <div class="sk-card figure"><i class="sk line sm w-50"></i><i class="sk line xl w-40"></i></div>
            }
          </div>
          <div class="sk-card chart">
            <i class="sk line lg w-30"></i>
            <div class="bars">
              @for (h of [60, 85, 40, 70, 55, 90, 35]; track $index) {
                <i class="sk bar" [style.height.%]="h"></i>
              }
            </div>
          </div>
          <ng-container *ngTemplateOutlet="table" />
        }
      }
      <ng-template #table>
        <div class="sk-card grid">
          <div class="sk-row header">
            @for (c of columnList(); track c) {
              <i class="sk line sm" [style.width.%]="60"></i>
            }
          </div>
          @for (r of rowList(); track r) {
            <div class="sk-row">
              @for (c of columnList(); track c) {
                <i class="sk line" [style.width.%]="widths[(r + c) % widths.length]"></i>
              }
            </div>
          }
        </div>
      </ng-template>
    </div>
  `,
  imports: [NgTemplateOutlet],
  styles: `
    :host { display: block; }
    .skeleton { display: grid; gap: 16px; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .sk-card {
      box-sizing: border-box;
      border: 1px solid var(--fm-border, #e2e8e5);
      border-radius: var(--fm-radius, 12px);
      background: #fff;
    }
    .sk-grid { display: grid; gap: clamp(12px, 1.5vw, 20px); }
    .sk {
      display: block;
      border-radius: 6px;
      background: linear-gradient(90deg, #eef2f0 25%, #f7f9f8 50%, #eef2f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.4s ease-in-out infinite;
    }
    .line { height: 12px; }
    .line.sm { height: 9px; }
    .line.lg { height: 16px; }
    .line.xl { height: 24px; }
    .w-30 { width: 30%; } .w-40 { width: 40%; } .w-50 { width: 50%; } .w-60 { width: 60%; } .w-70 { width: 70%; }

    .grid { overflow: hidden; }
    .sk-row { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); gap: 24px; align-items: center; padding: 15px 18px; border-top: 1px solid #eef2f0; }
    .lines .sk-row:first-child { border-top: 0; }
    .sk-row.header { padding-block: 14px; border-top: 0; background: var(--fm-surface-muted, #f8faf9); }

    .cards { grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr)); }
    .card { display: grid; gap: 12px; padding: 20px; }
    .sk-head, .sk-actions { display: flex; justify-content: space-between; gap: 10px; }
    .sk-actions { justify-content: flex-start; padding-top: 14px; border-top: 1px solid #eef2f0; }
    .sk-split { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .icon { width: 40px; height: 40px; border-radius: 10px; }
    .pill { width: 64px; height: 22px; border-radius: 999px; }
    .button { width: 96px; height: 30px; border-radius: 8px; }

    .form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; max-width: 760px; padding: 22px; }
    .field { display: grid; gap: 8px; }
    .input { height: 36px; border-radius: 8px; }
    .form .primary { grid-column: 1 / -1; justify-self: end; width: 120px; height: 36px; }

    .figures { grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr)); }
    .figure { display: grid; gap: 10px; padding: 16px; }
    .chart { display: grid; gap: 16px; padding: 18px; }
    .bars { display: flex; align-items: flex-end; gap: 6%; height: 180px; padding: 0 4%; border-bottom: 1px solid #eef2f0; }
    .bar { flex: 1; border-radius: 6px 6px 0 0; }

    @keyframes shimmer {
      from { background-position: 100% 0; }
      to { background-position: -100% 0; }
    }
    @media (prefers-reduced-motion: reduce) { .sk { animation: none; } }
    @media (max-width: 700px) {
      .form { grid-template-columns: 1fr; }
      .sk-row { gap: 12px; }
    }
  `,
  host: { '[style.--cols]': 'columns()' },
})
export class Skeleton {
  readonly variant = input<'table' | 'lines' | 'cards' | 'form' | 'report'>('table');
  /** Table rows, cards, or form fields. */
  readonly count = input(6);
  readonly columns = input(5);
  readonly label = input('Loading…');
  readonly widths = [70, 55, 85, 45, 65, 75, 50];
  readonly countList = computed(() => Array.from({ length: this.count() }, (_, i) => i));
  readonly rowList = this.countList;
  readonly columnList = computed(() => Array.from({ length: this.columns() }, (_, i) => i));
}
