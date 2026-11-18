import { Injectable, inject } from '@angular/core';
import { ApiResponse, ApiService, Page } from './api.service';

export type Status = 'Scheduled' | 'In transit' | 'Delivered';
export interface TransportRecord {
  id: string;
  customer: string;
  origin: string;
  destination: string;
  vehicle: string;
  date: string;
  status: Status;
}
export type TransportDraft = Omit<TransportRecord, 'id'>;
export const emptyRecord = (): TransportDraft => ({
  customer: '',
  origin: '',
  destination: '',
  vehicle: '',
  date: '',
  status: 'Scheduled',
});

@Injectable({ providedIn: 'root' })
export class TransportService {
  private readonly api = inject(ApiService);

  list(page: number): Promise<Page<TransportRecord>> {
    return this.api.request('GET', 'transports?page=' + page);
  }

  async save(draft: TransportDraft, id: string | null): Promise<TransportRecord> {
    const response = await this.api.request<ApiResponse<TransportRecord>>(
      id ? 'PUT' : 'POST',
      id ? 'transports/' + id : 'transports',
      draft,
    );
    return response.data;
  }

  async updateStatus(id: string, status: Status): Promise<TransportRecord> {
    const response = await this.api.request<ApiResponse<TransportRecord>>(
      'PATCH',
      'transports/' + id + '/status',
      { status },
    );
    return response.data;
  }
  delete(id: string): Promise<void> {
    return this.api.request('DELETE', 'transports/' + id);
  }
}
