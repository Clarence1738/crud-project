import { TestBed } from '@angular/core/testing';
import { ApiService } from '../api.service';
import { DocumentService } from './document.service';

describe('Document uploads', () => {
  it('uses a multipart method override for replacement files', async () => {
    const request = vi.fn().mockResolvedValue({ data: {} });
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: { request } }] });
    const file = new File(['receipt'], 'receipt.txt', { type: 'text/plain' });
    await TestBed.inject(DocumentService).save('Receipt', file, 'document-id');
    const [method, path, body] = request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('documents/document-id');
    expect(body.get('_method')).toBe('PUT');
    expect(body.get('file')).toBe(file);
    expect(body.has('user_id')).toBe(false);
  });
});
