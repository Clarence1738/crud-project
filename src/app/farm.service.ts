import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ApiResponse, ApiService, Page } from './api.service';

export type FarmRole = 'Owner' | 'Manager' | 'Worker';
export interface Farm { id: string; name: string; county: string; location: string | null; size_hectares: string | null; notes: string | null; role: FarmRole; /** Owner, or a Manager when the owner allows finance access in settings. */ finance_access?: boolean; }
export interface FarmField { id: string; name: string; size_hectares: string; soil_type: string | null; status: 'Available'|'In use'|'Resting'; notes: string | null; }
export interface CropSeason { id: string; field_id: string; crop: string; variety: string | null; field_name: string; area_hectares: string; planted_on: string | null; expected_harvest_date: string | null; status: string; expected_yield_kg: string | null; harvested_kg: string; notes: string | null; archived_at: string | null; }
export interface LivestockRecord { id: string; tracking_type: string; tag_number: string | null; group_name: string | null; species: string; breed: string | null; sex: string | null; quantity: number; birth_date: string | null; status: string; location: string | null; notes: string | null; archived_at: string | null; }
export interface FarmMember { id: number; name: string; email: string; role: FarmRole; joined_at: string; }
export interface FarmInvitation { id: string; email: string; role: FarmRole; expires_at: string; code?: string; }
export interface FarmSettings { reminder_days: number; manager_finance_access: boolean; season_start_month: string; currency: string; timezone: string; }
export type ProductionKind = 'Milk' | 'Eggs' | 'Weight' | 'Wool';
export type ProductionSession = 'Morning' | 'Midday' | 'Evening' | 'Whole day';
export interface ProductionSlot { measured_on: string; session: ProductionSession; kind: ProductionKind; }
export interface ProductionSheetRow { id: string; label: string; species: string; sex: string | null; value: number | null; last: number | null; /** Sessions already recorded that rule out this one (whole day vs by session). */ blocked_by: ProductionSession[] | null; }
export interface ProductionSaveResult { saved: number; corrected: number; total: number; unit: string; }
export interface ProductionPoint { date: string; total: number; Morning: number; Midday: number; Evening: number; 'Whole day': number; }
/** Today against yesterday for one animal type (species null = all types together). */
export interface ProductionCompare { species: string | null; today: number; yesterday: number; yesterday_same_sessions: number; change_percent: number | null; sessions: { session: ProductionSession; today: number; yesterday: number }[]; animals_today: number; animals_yesterday: number; animals_active: number; per_animal_yesterday: number | null; }
/** Each point also carries a "species:<name>" total per animal type listed in `species`. */
export interface ProductionTrend { kind: ProductionKind; unit: string; species: string[]; series: (ProductionPoint & Record<string, number | string>)[]; today: number; last7_average: number; change_percent: number | null; by_species: { species: string; today: number; last7_average: number }[]; compare: ProductionCompare[]; }
export interface AdminUser { id: number; name: string; email: string; role: string; status: 'Active' | 'Suspended'; farms: number; last_login_at: string | null; created_at: string | null; }
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

/** Role capabilities mirrored from backend FarmAccess. The backend remains authoritative. */
export const farmCan = {
  manageRecords: (role?: FarmRole | null) => role === 'Owner' || role === 'Manager',
  finance: (role?: FarmRole | null) => role === 'Owner',
  manageFarm: (role?: FarmRole | null) => role === 'Owner',
  /** Finance for this farm: the owner, or a Manager the owner has allowed in farm settings. */
  seeFinance: (farm?: Pick<Farm, 'role' | 'finance_access'> | null) => !!farm && (farm.finance_access ?? farm.role === 'Owner'),
};

const SELECTED_FARM_KEY = 'farm-management.selected-farm';

@Injectable({ providedIn: 'root' })
export class FarmService {
  private readonly api = inject(ApiService);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  /** The selected farm ID survives reloads. Callers only use it when it appears in the user's farm list. */
  readonly selectedFarmId = signal<string | null>(this.readStoredFarm());

  selectFarm(id: string): void {
    this.selectedFarmId.set(id);
    this.store(id);
  }
  clearSelection(): void {
    this.selectedFarmId.set(null);
    this.store(null);
  }
  /** Chooses the remembered farm when the user is still a member, otherwise the first farm. */
  pickFarm(farms: Farm[]): Farm | null {
    const remembered = farms.find((farm) => farm.id === this.selectedFarmId());
    if (!remembered && this.selectedFarmId()) this.clearSelection();
    return remembered ?? farms[0] ?? null;
  }

  async farms(): Promise<Farm[]> { return (await this.api.request<ApiResponse<Farm[]>>('GET', 'farms')).data; }
  async createFarm(data: object): Promise<Farm> { return (await this.api.request<ApiResponse<Farm>>('POST', 'farms', data)).data; }
  async updateFarm(id: string, data: object): Promise<Farm> { return (await this.api.request<ApiResponse<Farm>>('PUT', `farms/${id}`, data)).data; }
  async overview(id: string): Promise<FarmOverview> { return (await this.api.request<ApiResponse<FarmOverview>>('GET', `farms/${id}/overview`)).data; }

  crops(id: string, archived = false): Promise<Page<CropSeason>> { return this.api.request('GET', `farms/${id}/crops${archived ? '?archived=1' : ''}`); }
  async createCrop(id: string, data: object): Promise<CropSeason> { return (await this.api.request<ApiResponse<CropSeason>>('POST', `farms/${id}/crops`, data)).data; }
  async updateCrop(id: string, crop: string, data: object): Promise<CropSeason> { return (await this.api.request<ApiResponse<CropSeason>>('PUT', `farms/${id}/crops/${crop}`, data)).data; }
  async archiveCrop(id: string, crop: string, archived: boolean): Promise<CropSeason> { return (await this.api.request<ApiResponse<CropSeason>>('PATCH', `farms/${id}/crops/${crop}/archive`, { archived })).data; }

  livestock(id: string, archived = false): Promise<Page<LivestockRecord>> { return this.api.request('GET', `farms/${id}/livestock${archived ? '?archived=1' : ''}`); }
  async createLivestock(id: string, data: object): Promise<LivestockRecord> { return (await this.api.request<ApiResponse<LivestockRecord>>('POST', `farms/${id}/livestock`, data)).data; }
  async updateLivestock(id: string, record: string, data: object): Promise<LivestockRecord> { return (await this.api.request<ApiResponse<LivestockRecord>>('PUT', `farms/${id}/livestock/${record}`, data)).data; }
  async archiveLivestock(id: string, record: string, archived: boolean): Promise<LivestockRecord> { return (await this.api.request<ApiResponse<LivestockRecord>>('PATCH', `farms/${id}/livestock/${record}/archive`, { archived })).data; }

  async operations(id: string, module: string): Promise<Record<string, unknown>[]> {
    return (await this.api.request<ApiResponse<Record<string, unknown>[]>>('GET', `farms/${id}/operations/${module}`)).data;
  }
  async createOperation(id: string, module: string, data: object): Promise<Record<string, unknown>> {
    return (await this.api.request<ApiResponse<Record<string, unknown>>>('POST', `farms/${id}/operations/${module}`, data)).data;
  }
  async deleteOperation(id: string, module: string, record: string): Promise<void> {
    await this.api.request('DELETE', `farms/${id}/operations/${module}/${record}`);
  }
  async updateOperation(id: string, module: string, record: string, data: object): Promise<Record<string, unknown>> {
    return (await this.api.request<ApiResponse<Record<string, unknown>>>('PUT', `farms/${id}/operations/${module}/${record}`, data)).data;
  }
  async updateTaskStatus(id: string, task: string, status: string): Promise<Record<string, unknown>> {
    return (await this.api.request<ApiResponse<Record<string, unknown>>>('PATCH', `farms/${id}/tasks/${task}/status`, { status })).data;
  }

  async settings(id: string): Promise<FarmSettings> { return (await this.api.request<ApiResponse<FarmSettings>>('GET', `farms/${id}/settings`)).data; }
  async updateSettings(id: string, data: Partial<FarmSettings>): Promise<FarmSettings> { return (await this.api.request<ApiResponse<FarmSettings>>('PUT', `farms/${id}/settings`, data)).data; }
  async productionSheet(id: string, slot: ProductionSlot): Promise<ProductionSheetRow[]> {
    const query = new URLSearchParams({ ...slot }).toString();
    return (await this.api.request<ApiResponse<ProductionSheetRow[]>>('GET', `farms/${id}/production/sheet?${query}`)).data;
  }
  async saveProductionSheet(id: string, slot: ProductionSlot, entries: { livestock_record_id: string; value: number | null }[]): Promise<ProductionSaveResult> {
    return (await this.api.request<ApiResponse<ProductionSaveResult>>('POST', `farms/${id}/production/sheet`, { ...slot, entries })).data;
  }
  async productionSummary(id: string, days = 14): Promise<ProductionTrend[]> {
    return (await this.api.request<ApiResponse<{ kinds: ProductionTrend[] }>>('GET', `farms/${id}/production/summary?days=${days}`)).data.kinds;
  }
  async adminUsers(): Promise<AdminUser[]> { return (await this.api.request<ApiResponse<AdminUser[]>>('GET', 'admin/users')).data; }
  async setUserStatus(user: number, status: AdminUser['status']): Promise<AdminUser> { return (await this.api.request<ApiResponse<AdminUser>>('PATCH', `admin/users/${user}/status`, { status })).data; }

  async members(id: string): Promise<FarmMember[]> { return (await this.api.request<ApiResponse<FarmMember[]>>('GET', `farms/${id}/members`)).data; }
  async updateMemberRole(id: string, user: number, role: FarmRole): Promise<void> { await this.api.request('PATCH', `farms/${id}/members/${user}`, { role }); }
  async removeMember(id: string, user: number): Promise<void> { await this.api.request('DELETE', `farms/${id}/members/${user}`); }
  async invitations(id: string): Promise<FarmInvitation[]> { return (await this.api.request<ApiResponse<FarmInvitation[]>>('GET', `farms/${id}/invitations`)).data; }
  async invite(id: string, email: string, role: FarmRole): Promise<FarmInvitation> { return (await this.api.request<ApiResponse<FarmInvitation>>('POST', `farms/${id}/invitations`, { email, role })).data; }
  async revokeInvitation(id: string, invitation: string): Promise<void> { await this.api.request('DELETE', `farms/${id}/invitations/${invitation}`); }
  async acceptInvitation(code: string): Promise<Farm> { return (await this.api.request<ApiResponse<Farm>>('POST', 'farm-invitations/accept', { code })).data; }

  private readStoredFarm(): string | null {
    if (!this.browser) return null;
    try { return localStorage.getItem(SELECTED_FARM_KEY); } catch { return null; }
  }
  private store(id: string | null): void {
    if (!this.browser) return;
    try {
      if (id) localStorage.setItem(SELECTED_FARM_KEY, id);
      else localStorage.removeItem(SELECTED_FARM_KEY);
    } catch { /* Storage can be unavailable in private browsing; selection then lasts for the session. */ }
  }
}
