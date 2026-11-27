import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxTemplateDirective } from 'devextreme-angular/core';

export type CoverageStatus = 'Working' | 'Preview';
export interface CoverageRow {
  ref: string;
  area: string;
  function: string;
  screen: string;
  route: string;
  status: CoverageStatus;
}

/**
 * Maps every FMS-FS use case, report and dashboard function to the screen that covers it.
 * Working: saved through the Laravel API. Preview: screen only, API still to be built.
 */
export const COVERAGE: CoverageRow[] = [
  {
    ref: 'UC-01',
    area: 'Access',
    function: 'Register and sign in',
    screen: 'Sign in',
    route: '/',
    status: 'Working',
  },
  {
    ref: 'UC-02',
    area: 'Farm setup',
    function: 'Create and edit a farm',
    screen: 'Farms',
    route: '/farms',
    status: 'Working',
  },
  {
    ref: 'UC-03',
    area: 'Farm setup',
    function: 'Select the active farm',
    screen: 'Every screen',
    route: '/dashboard',
    status: 'Working',
  },
  {
    ref: 'UC-04',
    area: 'Farm setup',
    function: 'Invite a person to a farm',
    screen: 'Farms, members',
    route: '/farms',
    status: 'Working',
  },
  {
    ref: 'UC-05',
    area: 'Farm setup',
    function: 'Join a farm with an invitation code',
    screen: 'Farms',
    route: '/farms',
    status: 'Working',
  },
  {
    ref: 'UC-06',
    area: 'Farm setup',
    function: 'Manage members and roles',
    screen: 'Farms, members',
    route: '/farms',
    status: 'Working',
  },
  {
    ref: 'UC-07',
    area: 'Farm setup',
    function: 'Maintain fields',
    screen: 'Fields',
    route: '/fields',
    status: 'Working',
  },
  {
    ref: 'UC-08',
    area: 'Crops',
    function: 'Plan and manage a crop season',
    screen: 'Crop seasons',
    route: '/crops',
    status: 'Working',
  },
  {
    ref: 'UC-09',
    area: 'Crops',
    function: 'Record a crop activity',
    screen: 'Crop activities',
    route: '/activities',
    status: 'Working',
  },
  {
    ref: 'UC-10',
    area: 'Crops',
    function: 'Record a harvest',
    screen: 'Harvests',
    route: '/harvests',
    status: 'Working',
  },
  {
    ref: 'UC-11',
    area: 'Crops',
    function: 'Record a crop loss or incident',
    screen: 'Losses and incidents',
    route: '/incidents',
    status: 'Working',
  },
  {
    ref: 'UC-12',
    area: 'Livestock',
    function: 'Register livestock',
    screen: 'Livestock',
    route: '/livestock',
    status: 'Working',
  },
  {
    ref: 'UC-13',
    area: 'Livestock',
    function: 'Record an animal health event',
    screen: 'Animal health',
    route: '/health',
    status: 'Working',
  },
  {
    ref: 'UC-14',
    area: 'Livestock',
    function: 'Record breeding',
    screen: 'Breeding',
    route: '/breeding',
    status: 'Working',
  },
  {
    ref: 'UC-14',
    area: 'Livestock',
    function: 'Record births',
    screen: 'Births',
    route: '/births',
    status: 'Working',
  },
  {
    ref: 'URS-L03',
    area: 'Livestock',
    function: 'Record weight and production',
    screen: 'Weight and production',
    route: '/production',
    status: 'Working',
  },
  {
    ref: 'UC-15',
    area: 'Livestock',
    function: 'Record a livestock exit',
    screen: 'Livestock (status)',
    route: '/livestock',
    status: 'Working',
  },
  {
    ref: 'UC-16',
    area: 'Resources',
    function: 'Record a stock movement',
    screen: 'Stock movements',
    route: '/movements',
    status: 'Working',
  },
  {
    ref: 'URS-I01',
    area: 'Resources',
    function: 'Maintain items',
    screen: 'Inventory',
    route: '/inventory',
    status: 'Working',
  },
  {
    ref: 'URS-I01',
    area: 'Resources',
    function: 'Maintain suppliers and buyers',
    screen: 'Suppliers and buyers',
    route: '/suppliers',
    status: 'Working',
  },
  {
    ref: 'URS-I01',
    area: 'Resources',
    function: 'Maintain stock locations',
    screen: 'Stock locations',
    route: '/locations',
    status: 'Working',
  },
  {
    ref: 'UC-17',
    area: 'Resources',
    function: 'Create and assign a task',
    screen: 'Tasks',
    route: '/tasks',
    status: 'Working',
  },
  {
    ref: 'UC-18',
    area: 'Resources',
    function: 'Complete an assigned task',
    screen: 'Tasks (update status)',
    route: '/tasks',
    status: 'Working',
  },
  {
    ref: 'UC-19',
    area: 'Resources',
    function: 'Maintain equipment',
    screen: 'Equipment',
    route: '/equipment',
    status: 'Working',
  },
  {
    ref: 'UC-19',
    area: 'Resources',
    function: 'Record maintenance',
    screen: 'Maintenance history',
    route: '/maintenance',
    status: 'Working',
  },
  {
    ref: 'UC-20',
    area: 'Finance',
    function: 'Record an expense or sale',
    screen: 'Finance',
    route: '/finance',
    status: 'Working',
  },
  {
    ref: 'UC-21',
    area: 'Overview',
    function: 'Dashboard cards and land use',
    screen: 'Dashboard',
    route: '/dashboard',
    status: 'Working',
  },
  {
    ref: 'UC-21',
    area: 'Overview',
    function: 'Reminders: overdue tasks, health, low stock, maintenance, month finance',
    screen: 'Dashboard',
    route: '/dashboard',
    status: 'Working',
  },
  {
    ref: 'UC-22',
    area: 'Information',
    function: 'R1 Crop activity and yield',
    screen: 'Reports',
    route: '/reports',
    status: 'Working',
  },
  {
    ref: 'UC-22',
    area: 'Information',
    function: 'R2 Livestock and health due',
    screen: 'Reports',
    route: '/reports',
    status: 'Working',
  },
  {
    ref: 'UC-22',
    area: 'Information',
    function: 'R3 Breeding and expected births',
    screen: 'Reports',
    route: '/reports',
    status: 'Working',
  },
  {
    ref: 'UC-22',
    area: 'Information',
    function: 'R4 Feed and inventory balance',
    screen: 'Reports',
    route: '/reports',
    status: 'Working',
  },
  {
    ref: 'UC-22',
    area: 'Information',
    function: 'R5 Task status',
    screen: 'Reports',
    route: '/reports',
    status: 'Working',
  },
  {
    ref: 'UC-22',
    area: 'Information',
    function: 'R6 Maintenance due',
    screen: 'Reports',
    route: '/reports',
    status: 'Working',
  },
  {
    ref: 'UC-22',
    area: 'Information',
    function: 'R7 Expenses, sales and gross margin',
    screen: 'Reports',
    route: '/reports',
    status: 'Working',
  },
  {
    ref: 'UC-23',
    area: 'Information',
    function: 'Attach and manage documents',
    screen: 'Documents',
    route: '/documents',
    status: 'Working',
  },
  {
    ref: 'UC-24',
    area: 'Information',
    function: 'Archive and restore a record',
    screen: 'Crop seasons, Livestock',
    route: '/crops',
    status: 'Working',
  },
  {
    ref: 'URS-A03',
    area: 'Administration',
    function: 'Audit history',
    screen: 'Audit history',
    route: '/audit',
    status: 'Working',
  },
  {
    ref: 'URS-D02',
    area: 'Administration',
    function: 'Farm settings',
    screen: 'Settings',
    route: '/settings',
    status: 'Working',
  },
  {
    ref: 'FS 3',
    area: 'Administration',
    function: 'System Administrator: accounts and configuration',
    screen: 'System administration',
    route: '/admin',
    status: 'Working',
  },
];

@Component({
  selector: 'app-farm-coverage',
  imports: [DxDataGridComponent, DxiDataGridColumnComponent, DxTemplateDirective],
  styleUrls: [
    './farm-module.css',
    './farm-fluid.css',
    './farm-collab.css',
    './farm-land.css',
    './farm-preview.css',
    './farm-theme.css',
  ],
  template: ` <section class="module-page">
    <header class="module-head">
      <div>
        <h1>Functional coverage</h1>
        <p>
          Every function in the Functional Specification (FMS-FS v1.0) and the screen that covers
          it.
        </p>
      </div>
    </header>
    <div class="report-summary">
      <article>
        <span>Functions covered</span><strong>{{ rows.length }} of {{ rows.length }}</strong>
      </article>
      <article>
        <span>Working (saved to the server)</span><strong>{{ working }}</strong>
      </article>
      <article>
        <span>Not yet built</span><strong>{{ rows.length - working }}</strong>
      </article>
    </div>
    <p class="preview-note">
      <span class="dx-icon dx-icon-info"></span>Every function saves through the Laravel API and
      PostgreSQL, with farm membership and role checks on the server.
    </p>
    <section class="grid-card">
      <dx-data-grid
        [dataSource]="rows"
        [rowAlternationEnabled]="true"
        [columnAutoWidth]="true"
        [filterRow]="{ visible: true }"
        [headerFilter]="{ visible: true }"
        [grouping]="{ autoExpandAll: true }"
        [showBorders]="false"
        [paging]="{ enabled: false }"
      >
        <dxi-data-grid-column dataField="area" caption="Area" [groupIndex]="0" />
        <dxi-data-grid-column dataField="ref" caption="Reference" />
        <dxi-data-grid-column dataField="function" caption="Function" />
        <dxi-data-grid-column dataField="screen" caption="Screen" cellTemplate="screenCell" />
        <dxi-data-grid-column dataField="status" caption="Status" cellTemplate="statusCell" />
        <div *dxTemplate="let cell of 'screenCell'">
          <button type="button" class="edit-action" (click)="open(cell.data.route)">
            {{ cell.value }}
          </button>
        </div>
        <div *dxTemplate="let cell of 'statusCell'">
          <span
            class="status-pill"
            [class.working]="cell.value === 'Working'"
            [class.preview]="cell.value === 'Preview'"
            >{{ cell.value }}</span
          >
        </div>
      </dx-data-grid>
    </section>
  </section>`,
})
export class FarmCoverage {
  private readonly router = inject(Router);
  readonly rows = COVERAGE;
  readonly working = COVERAGE.filter((r) => r.status === 'Working').length;
  open(route: string): void {
    void this.router.navigateByUrl(route);
  }
}
