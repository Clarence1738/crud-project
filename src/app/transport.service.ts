import { Injectable, inject } from '@angular/core';
import { ApiResponse, ApiService, Page } from './api.service';

export type Status = 'Scheduled' | 'In transit' | 'Delivered';
export type DeliveryException = 'due_today' | 'overdue' | 'missing_eta';
export interface TransportFilters {
  search?: string;
  status?: Status | '';
  exception?: DeliveryException | '';
}
export interface TransportPage extends Page<TransportRecord> {
  exceptions: Record<DeliveryException, number>;
}
export interface DeliveryAnalytics {
  delivered: number;
  on_time: {
    count: number;
    eligible: number;
    missing_delivery_date: number;
    missing_promised_date: number;
    rate: number | null;
    baseline_coverage: number | null;
  };
  transit: {
    eligible: number;
    excluded: number;
    median_days: number | null;
    p90_days: number | null;
  };
}
export interface CalendarShipment {
  id: string;
  recipient_company: string;
  reference: string | null;
  expected_arrival_date: string;
  status: Status;
}
export interface TransportRecord {
  id: string;
  sender_company: string | null;
  recipient_company: string;
  origin: string;
  destination: string;
  vehicle: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  date: string;
  expected_arrival_date: string | null;
  promised_arrival_date?: string | null;
  status: Status;
  reference?: string | null;
  goods_description?: string | null;
  quantity?: number | null;
  notes?: string | null;
  delivered_at?: string | null;
}
export interface TransportDetails extends TransportRecord {
  transit_days: number | null;
  history: { status: Status; changed_at: string }[];
}
export type TransportDraft = Omit<
  TransportRecord,
  'id' | 'sender_company' | 'expected_arrival_date' | 'promised_arrival_date' | 'delivered_at'
> & {
  sender_company: string;
  expected_arrival_date: string;
};
export const emptyRecord = (): TransportDraft => ({
  sender_company: '',
  recipient_company: '',
  origin: '',
  destination: '',
  vehicle: '',
  driver_name: '',
  driver_phone: '',
  date: '',
  expected_arrival_date: '',
  reference: '',
  goods_description: '',
  quantity: null,
  notes: '',
  status: 'Scheduled',
});

@Injectable({ providedIn: 'root' })
export class TransportService {
  private readonly api = inject(ApiService);

  list(page: number, filters?: TransportFilters): Promise<TransportPage> {
    const params = new URLSearchParams({ page: String(page) });
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    if (filters?.exception) params.set('exception', filters.exception);
    return this.api.request('GET', 'transports?' + params);
  }

  async details(id: string): Promise<TransportDetails> {
    const response = await this.api.request<ApiResponse<TransportDetails>>(
      'GET',
      'transports/' + id,
    );
    return response.data;
  }

  async analytics(): Promise<DeliveryAnalytics> {
    const response = await this.api.request<ApiResponse<DeliveryAnalytics>>(
      'GET',
      'transports/analytics',
    );
    return response.data;
  }

  async calendar(start: string, end: string): Promise<CalendarShipment[]> {
    const params = new URLSearchParams({ start, end });
    const response = await this.api.request<ApiResponse<CalendarShipment[]>>(
      'GET',
      'transports/calendar?' + params,
    );
    return response.data;
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
