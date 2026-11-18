import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';
import { signal } from '@angular/core';

describe('Server authentication', () => {
  const api = { csrf: vi.fn(), request: vi.fn(), expired: signal(false) };

  beforeEach(() => {
    vi.resetAllMocks();
    api.expired.set(false);
    api.csrf.mockResolvedValue(undefined);
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  });

  it('loads the current user from the server and clears it after logout', async () => {
    const auth = TestBed.inject(AuthService);
    api.request.mockResolvedValueOnce({
      data: { id: 1, name: 'Alice', email: 'alice@example.com' },
    });
    await auth.restore();
    expect(auth.user()).toBe('alice@example.com');
    api.request.mockResolvedValueOnce(undefined);
    await auth.logout();
    expect(auth.user()).toBeNull();
    expect(api.request).toHaveBeenLastCalledWith('POST', 'logout');
  });

  it('does not trust browser storage as proof of login', async () => {
    sessionStorage.setItem('nextrans.demo-session.v1', 'admin@nextrans.local');
    api.request.mockRejectedValueOnce(new HttpErrorResponse({ status: 401 }));
    const auth = TestBed.inject(AuthService);
    await auth.restore();
    expect(auth.user()).toBeNull();
    sessionStorage.clear();
  });

  it('does not report a successful logout when the server fails', async () => {
    const auth = TestBed.inject(AuthService);
    api.request.mockResolvedValueOnce({
      data: { id: 1, name: 'Alice', email: 'alice@example.com' },
    });
    await auth.login('alice@example.com', 'password');
    api.request.mockRejectedValueOnce(new HttpErrorResponse({ status: 500 }));
    await expect(auth.logout()).rejects.toThrow();
    expect(auth.user()).toBe('alice@example.com');
  });

  it('hides the user when an API call reports an expired session', async () => {
    const auth = TestBed.inject(AuthService);
    api.request.mockResolvedValueOnce({
      data: { id: 1, name: 'Alice', email: 'alice@example.com' },
    });
    await auth.restore();
    api.expired.set(true);
    expect(auth.user()).toBeNull();
  });
});
