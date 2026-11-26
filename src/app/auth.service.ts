import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiResponse, ApiService } from './api.service';

interface User {
  id: number;
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly currentUser = signal<User | null>(null);
  readonly user = computed(() => (this.api.expired() ? null : (this.currentUser()?.email ?? null)));
  readonly userId = computed(() => (this.api.expired() ? null : (this.currentUser()?.id ?? null)));

  async restore(): Promise<void> {
    await this.api.csrf();
    try {
      const response = await this.api.request<ApiResponse<User>>('GET', 'me');
      this.api.expired.set(false);
      this.currentUser.set(response.data);
    } catch (error) {
      this.currentUser.set(null);
      if (!(error instanceof HttpErrorResponse && error.status === 401)) throw error;
    }
  }

  async login(email: string, password: string): Promise<void> {
    await this.authenticate('login', { email, password });
  }

  async register(
    name: string,
    email: string,
    password: string,
    confirmation: string,
  ): Promise<void> {
    await this.authenticate('register', {
      name,
      email,
      password,
      password_confirmation: confirmation,
    });
  }

  private async authenticate(path: string, credentials: object): Promise<void> {
    const response = await this.api.request<ApiResponse<User>>('POST', path, credentials);
    await this.api.csrf();
    this.api.expired.set(false);
    this.currentUser.set(response.data);
  }

  async logout(): Promise<void> {
    await this.api.request<void>('POST', 'logout');
    this.currentUser.set(null);
    this.api.expired.set(false);
    await this.api.csrf();
  }
}
