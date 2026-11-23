import { Injectable, inject, signal } from '@angular/core';
import { ApiResponse, ApiService, Page } from './api.service';

export interface Farm { id: string; name: string; county: string; location: string | null; size_hectares: string | null; notes: string | null; }
export interface FarmField { id: string; name: string; size_hectares: string; soil_type: string | null; status: 'Available'|'In use'|'Resting'; notes: string | null; }
export interface CropSeason { id: string; field_id: string; crop: string; variety: string | null; field_name: string; area_hectares: string; planted_on: string | null; expected_harvest_date: string | null; status: string; expected_yield_kg: string | null; harvested_kg: string; }
export interface LivestockRecord { id: string; tracking_type: string; tag_number: string | null; group_name: string | null; species: string; breed: string | null; sex: string | null; quantity: number; status: string; location: string | null; }
export interface FarmOverview {
  crops: number;
  active_crops: number;
  livestock: number;
  crop_breakdown: { crop: string; count: number }[];
  livestock_breakdown: { species: string; count: number }[];
  land: {
    total_hectares: number;
    used_hectares: number;
    remaining_hectares: number;
    used_percentage: number | null;
    overallocated_hectares: number;
    by_crop: { crop: string; hectares: number }[];
  };
}

@Injectable({ providedIn: 'root' })
export class FarmService {
  private readonly api = inject(ApiService);
  readonly selectedFarmId = signal<string | null>(null);

  selectFarm(id: string): void {
    this.selectedFarmId.set(id);
  }
  async farms(): Promise<Farm[]> { return (await this.api.request<ApiResponse<Farm[]>>('GET', 'farms')).data; }
  async createFarm(data: object): Promise<Farm> { return (await this.api.request<ApiResponse<Farm>>('POST', 'farms', data)).data; }
  async updateFarm(id: string, data: object): Promise<Farm> { return (await this.api.request<ApiResponse<Farm>>('PUT', `farms/${id}`, data)).data; }
  async overview(id: string): Promise<FarmOverview> { return (await this.api.request<ApiResponse<FarmOverview>>('GET', `farms/${id}/overview`)).data; }
  crops(id: string): Promise<Page<CropSeason>> { return this.api.request('GET', `farms/${id}/crops`); }
  async createCrop(id: string, data: object): Promise<CropSeason> { return (await this.api.request<ApiResponse<CropSeason>>('POST', `farms/${id}/crops`, data)).data; }
  livestock(id: string): Promise<Page<LivestockRecord>> { return this.api.request('GET', `farms/${id}/livestock`); }
  async createLivestock(id: string, data: object): Promise<LivestockRecord> { return (await this.api.request<ApiResponse<LivestockRecord>>('POST', `farms/${id}/livestock`, data)).data; }
  async operations(id: string, module: string): Promise<Record<string, unknown>[]> {
    return (await this.api.request<ApiResponse<Record<string, unknown>[]>>('GET', `farms/${id}/operations/${module}`)).data;
  }
  async createOperation(id: string, module: string, data: object): Promise<Record<string, unknown>> {
    return (await this.api.request<ApiResponse<Record<string, unknown>>>('POST', `farms/${id}/operations/${module}`, data)).data;
  }
  async updateOperation(id: string, module: string, record: string, data: object): Promise<Record<string, unknown>> {
    return (await this.api.request<ApiResponse<Record<string, unknown>>>('PUT', `farms/${id}/operations/${module}/${record}`, data)).data;
  }
}
