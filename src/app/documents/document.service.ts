import { Injectable, inject } from '@angular/core';
import { ApiResponse, ApiService, Page } from '../api.service';

export interface DocumentRecord {
  id: string;
  title: string;
  original_name: string;
  size: number;
  mime_type: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentService {
  private readonly api = inject(ApiService);

  list(page: number, transportId?: string): Promise<Page<DocumentRecord>> {
    const params = new URLSearchParams({ page: String(page) });
    if (transportId) params.set('transport_id', transportId);
    return this.api.request('GET', 'documents?' + params);
  }

  async save(
    title: string,
    file: File | null,
    id: string | null,
    transportId?: string,
  ): Promise<void> {
    const data = new FormData();
    data.append('title', title);
    if (file) data.append('file', file);
    // PHP parses multipart uploads through POST; Laravel honors the method override.
    if (id) data.append('_method', 'PUT');
    if (!id && transportId) data.append('transport_id', transportId);
    await this.api.request<ApiResponse<DocumentRecord>>(
      'POST',
      id ? 'documents/' + id : 'documents',
      data,
    );
  }

  delete(id: string): Promise<void> {
    return this.api.request('DELETE', 'documents/' + id);
  }
}
