import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { DxDataGridComponent, DxiDataGridColumnComponent } from 'devextreme-angular/ui/data-grid';
import { DxPieChartComponent } from 'devextreme-angular/ui/pie-chart';
import { DxTemplateDirective } from 'devextreme-angular/core';
import { FarmMembers } from './farm-members';
import { errorMessage } from './api.service';
import { CropSeason, Farm, farmCan, FarmField, FarmOverview, FarmService, LivestockRecord } from './farm.service';

@Component({ selector: 'app-farm-workspace', imports: [FormsModule, DxDataGridComponent, DxiDataGridColumnComponent, DxPieChartComponent, DxTemplateDirective, FarmMembers], templateUrl: './farm-workspace.html', styleUrls: ['./farm-workspace.css', './farm-land.css', './farm-fluid.css', './farm-collab.css'] })
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
  readonly editingCropId = signal<string|null>(null);
  readonly editingLivestockId = signal<string|null>(null);
  readonly showArchived = signal(false);
  readonly canManage = computed(() => farmCan.manageRecords(this.activeFarm()?.role));
  readonly canEditFarm = (farm: Farm) => farmCan.manageFarm(farm.role);
  farmDraft = { name: '', county: 'Nakuru', location: '', size_hectares: null as number|null, notes: '' };
  cropDraft = this.emptyCrop();
  livestockDraft = this.emptyLivestock();
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
      const selected = this.service.pickFarm(farms);
      if (selected) await this.selectFarm(selected.id);
    }
    catch (e) { this.error.set(errorMessage(e)); } finally { this.busy.set(false); }
  }
  async selectFarm(id: string): Promise<void> {
    const farm = this.farms().find((item) => item.id === id) ?? null; this.activeFarm.set(farm);
    if (!farm) return;
    this.service.selectFarm(farm.id);
    this.busy.set(true);
    try { const [overview,crops,livestock,fields] = await Promise.all([this.service.overview(id),this.service.crops(id,this.showArchived()),this.service.livestock(id,this.showArchived()),this.service.operations(id,'fields')]); this.overview.set(overview); this.crops.set(crops.data); this.livestock.set(livestock.data); this.fields.set(fields as unknown as FarmField[]); }
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
  openCrop(crop?: CropSeason): void {
    this.editingCropId.set(crop?.id ?? null);
    this.cropDraft = crop
      ? { crop: crop.crop, variety: crop.variety ?? '', field_id: crop.field_id ?? '', area_hectares: Number(crop.area_hectares), planted_on: crop.planted_on ?? '', expected_harvest_date: crop.expected_harvest_date ?? '', status: crop.status, expected_yield_kg: crop.expected_yield_kg === null ? null : Number(crop.expected_yield_kg), harvested_kg: Number(crop.harvested_kg ?? 0), notes: crop.notes ?? '' }
      : this.emptyCrop();
    this.form.set('crop');
  }
  openLivestock(record?: LivestockRecord): void {
    this.editingLivestockId.set(record?.id ?? null);
    this.livestockDraft = record
      ? { tracking_type: record.tracking_type, tag_number: record.tag_number ?? '', group_name: record.group_name ?? '', species: record.species, breed: record.breed ?? '', sex: record.sex ?? 'Female', quantity: record.quantity, birth_date: record.birth_date ?? '', status: record.status, location: record.location ?? '', notes: record.notes ?? '' }
      : this.emptyLivestock();
    this.form.set('livestock');
  }
  async saveCrop(): Promise<void> { const farm=this.activeFarm(); if(!farm)return; await this.run(async()=>{ const id=this.editingCropId(); if(id) await this.service.updateCrop(farm.id,id,this.cropDraft); else await this.service.createCrop(farm.id,this.cropDraft); this.form.set(null); this.editingCropId.set(null); await this.selectFarm(farm.id); }); }
  async saveLivestock(): Promise<void> { const farm=this.activeFarm(); if(!farm)return; await this.run(async()=>{ const id=this.editingLivestockId(); if(id) await this.service.updateLivestock(farm.id,id,this.livestockDraft); else await this.service.createLivestock(farm.id,this.livestockDraft); this.form.set(null); this.editingLivestockId.set(null); await this.selectFarm(farm.id); }); }
  /** Archiving hides a record from lists and dashboard totals without deleting its history. */
  async setArchived(kind: 'crop'|'livestock', id: string, archived: boolean): Promise<void> {
    const farm=this.activeFarm(); if(!farm)return;
    if(archived && !confirm(`Archive this ${kind==='crop'?'crop season':'livestock record'}? It will be hidden from lists and dashboard totals until restored.`)) return;
    await this.run(async()=>{ if(kind==='crop') await this.service.archiveCrop(farm.id,id,archived); else await this.service.archiveLivestock(farm.id,id,archived); await this.selectFarm(farm.id); });
  }
  async toggleArchived(): Promise<void> { this.showArchived.update(v=>!v); const farm=this.activeFarm(); if(farm) await this.selectFarm(farm.id); }
  joinCode = '';
  async membershipChanged(farm: Farm | null): Promise<void> {
    if (farm) this.service.selectFarm(farm.id); else this.service.clearSelection();
    this.activeFarm.set(null);
    await this.loadFarms();
  }
  async joinWithCode(): Promise<void> { await this.run(async()=>{ const farm=await this.service.acceptInvitation(this.joinCode); this.joinCode=''; await this.membershipChanged(farm); }); }
  private emptyCrop() { return { crop: 'Maize', variety: '', field_id: '', area_hectares: null as number|null, planted_on: '', expected_harvest_date: '', status: 'Planned', expected_yield_kg: null as number|null, harvested_kg: 0, notes: '' }; }
  private emptyLivestock() { return { tracking_type: 'Individual', tag_number: '', group_name: '', species: 'Dairy cattle', breed: '', sex: 'Female', quantity: 1, birth_date: '', status: 'Active', location: '', notes: '' }; }
  private async run(task:()=>Promise<void>): Promise<void> { this.busy.set(true); this.error.set(''); try{await task();}catch(e){this.error.set(errorMessage(e));}finally{this.busy.set(false);} }
}
