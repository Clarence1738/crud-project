import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export interface ApiResponse<T> {
  data: T;
}
export interface Page<T> extends ApiResponse<T[]> {
  current_page: number;
  last_page: number;
  total: number;
}

/** Same-origin session API. Session cookies stay HttpOnly; CSRF tokens live only in memory. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private csrfToken = '';
  readonly expired = signal(false);

  async csrf(): Promise<void> {
    const response = await firstValueFrom(this.http.get<{ token: string }>('/api/csrf'));
    this.csrfToken = response.token;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (method !== 'GET' && !this.csrfToken) await this.csrf();
    try {
      return await firstValueFrom(
        this.http.request<T>(method, '/api/' + path, {
          body,
          headers: new HttpHeaders({ Accept: 'application/json', 'X-CSRF-TOKEN': this.csrfToken }),
        }),
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 401) this.expired.set(true);
      if (error instanceof HttpErrorResponse && error.status === 419) {
        this.csrfToken = '';
        this.expired.set(true);
      }
      throw error;
    }
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0)
      return 'The server is unavailable. Check your connection and try again.';
    if (error.status === 401 || error.status === 419)
      return 'Your session expired. Please log in again.';
    if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
    const errors = error.error?.errors as Record<string, string[]> | undefined;
    if (errors) return Object.values(errors).flat().join(' ');
    if (error.status === 404) return 'This item is unavailable. Refresh the list.';
  }
  return 'The operation failed. Please try again.';
}
