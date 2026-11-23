import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxPieChartComponent } from 'devextreme-angular/ui/pie-chart';
import { errorMessage } from './api.service';
import { CropSeason, Farm, FarmField, FarmOverview, FarmService, LivestockRecord } from './farm.service';

@Component({ selector: 'app-farm-workspace', imports: [FormsModule, DxDataGridComponent, DxiDataGridColumnComponent, DxPieChartComponent], templateUrl: './farm-workspace.html', styleUrls: ['./farm-workspace.css', './farm-land.css', './farm-fluid.css'] })
export class FarmWorkspace implements OnInit {
  private readonly service = inject(FarmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly farms = signal<Farm[]>([]);
  readonly activeFarm = signal<Farm | null>(null);
  readonly overview = signal<FarmOverview | null>(null);
  readonly crops = signal<CropSeason[]>([]);
  readonly fields = signal<FarmField[]>([]);
  readonly livestock = signal<LivestockRecord[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly mode = computed(() => this.router.url.split(/[?#]/)[0].replace('/', '') || 'dashboard');
  readonly form = signal<'farm'|'crop'|'livestock'|null>(null);
  readonly editingFarmId = signal<string|null>(null);
  farmDraft = { name: '', county: 'Nakuru', location: '', size_hectares: null as number|null, notes: '' };
  cropDraft = { crop: 'Maize', variety: '', field_id: '', area_hectares: null as number|null, planted_on: '', expected_harvest_date: '', status: 'Planned', expected_yield_kg: null as number|null };
  livestockDraft = { tracking_type: 'Individual', tag_number: '', group_name: '', species: 'Dairy cattle', breed: '', sex: 'Female', quantity: 1, status: 'Active', location: '' };
  readonly cropPalette = ['#3f7d4c','#d8a33f','#8b6f47','#bf563f'];
  readonly landChart = computed(() => {
    const land = this.overview()?.land;
    if (!land) return [];
    return [
      ...land.by_crop.map((item) => ({ label: item.crop, hectares: Number(item.hectares) })),
      ...(land.remaining_hectares > 0
        ? [{ label: 'Available land', hectares: land.remaining_hectares }]
        : []),
    ];
  });
  readonly landPalette = ['#3f7d4c','#d8a33f','#8b6f47','#bf563f','#dce5df'];

  async ngOnInit(): Promise<void> { await this.loadFarms(); }
  async loadFarms(): Promise<void> {
    this.busy.set(true); this.error.set('');
    try {
      const farms = await this.service.farms();
      this.farms.set(farms);
      const remembered = this.service.selectedFarmId();
      const selected = farms.find((farm) => farm.id === remembered) ?? farms[0];
      if (selected) await this.selectFarm(selected.id);
    }
    catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }
  async selectFarm(id: string): Promise<void> {
    const farm = this.farms().find((item) => item.id === id) ?? null; this.activeFarm.set(farm);
    if (!farm) return;
    this.service.selectFarm(farm.id);
    this.busy.set(true);
    try { const [overview,crops,livestock,fields] = await Promise.all([this.service.overview(id),this.service.crops(id),this.service.livestock(id),this.service.operations(id,'fields')]); this.overview.set(overview); this.crops.set(crops.data); this.livestock.set(livestock.data); this.fields.set(fields as unknown as FarmField[]); }
    catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }
  openNewFarm(): void {
    this.editingFarmId.set(null);
    this.farmDraft = { name: '', county: 'Nakuru', location: '', size_hectares: null, notes: '' };
    this.form.set('farm');
  }
  editFarm(farm: Farm): void {
    this.editingFarmId.set(farm.id);
    this.farmDraft = { name: farm.name, county: farm.county, location: farm.location ?? '', size_hectares: farm.size_hectares === null ? null : Number(farm.size_hectares), notes: farm.notes ?? '' };
    this.form.set('farm');
  }
  async saveFarm(): Promise<void> { await this.run(async()=>{ const id=this.editingFarmId(); const farm=id ? await this.service.updateFarm(id,this.farmDraft) : await this.service.createFarm(this.farmDraft); this.farms.update(v=>id ? v.map(item=>item.id===farm.id?farm:item) : [...v,farm]); this.form.set(null); this.editingFarmId.set(null); await this.selectFarm(farm.id); }); }
  async saveCrop(): Promise<void> { const farm=this.activeFarm(); if(!farm)return; await this.run(async()=>{ await this.service.createCrop(farm.id,this.cropDraft); this.form.set(null); await this.selectFarm(farm.id); }); }
  async saveLivestock(): Promise<void> { const farm=this.activeFarm(); if(!farm)return; await this.run(async()=>{ await this.service.createLivestock(farm.id,this.livestockDraft); this.form.set(null); await this.selectFarm(farm.id); }); }
  private async run(task:()=>Promise<void>): Promise<void> { this.busy.set(true); this.error.set(''); try{await task();}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);} }
}
