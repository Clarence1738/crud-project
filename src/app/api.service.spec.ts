import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiService } from './api.service';

describe('Session API requests', () => {
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fetches a CSRF token before a mutation and sends it in the header', async () => {
    const pending = api.request('POST', 'login', {
      email: 'alice@example.com',
      password: 'secret',
    });
    http.expectOne('/api/csrf').flush({ token: 'csrf-test-token' });
    await Promise.resolve();
    await Promise.resolve();
    const request = http.expectOne('/api/login');
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-test-token');
    expect(request.request.body.email).toBe('alice@example.com');
    request.flush({ data: { email: 'alice@example.com' } });
    await pending;
  });

  it('marks expired sessions and never automatically repeats a rejected write', async () => {
    const pending = api.request('POST', 'documents', new FormData());
    const rejection = expect(pending).rejects.toMatchObject({ status: 419 });
    http.expectOne('/api/csrf').flush({ token: 'old-token' });
    await Promise.resolve();
    await Promise.resolve();
    http.expectOne('/api/documents').flush({}, { status: 419, statusText: 'Page Expired' });
    await rejection;
    expect(api.expired()).toBe(true);
    http.expectNone('/api/documents');
  });
});
