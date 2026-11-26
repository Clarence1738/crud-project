import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ApiService } from './api.service';
import { Farm, farmCan, FarmService } from './farm.service';

const farm = (id: string, role: Farm['role'] = 'Owner'): Farm => ({
  id,
  name: id,
  county: 'Nakuru',
  location: null,
  size_hectares: null,
  notes: null,
  role,
});

describe('Farm selection', () => {
  const api = { csrf: vi.fn(), request: vi.fn(), expired: signal(false) };
  const key = 'farm-management.selected-farm';

  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => void values.set(k, v),
      removeItem: (k: string) => void values.delete(k),
      clear: () => values.clear(),
    });
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
  });

  it('remembers the selected farm across a reload', () => {
    TestBed.inject(FarmService).selectFarm('farm-b');
    expect(localStorage.getItem(key)).toBe('farm-b');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ApiService, useValue: api }] });
    const reloaded = TestBed.inject(FarmService);
    expect(reloaded.selectedFarmId()).toBe('farm-b');
    expect(reloaded.pickFarm([farm('farm-a'), farm('farm-b')])?.id).toBe('farm-b');
  });

  it('ignores and forgets a remembered farm the user can no longer access', () => {
    localStorage.setItem(key, 'removed-farm');
    const service = TestBed.inject(FarmService);
    expect(service.pickFarm([farm('farm-a')])?.id).toBe('farm-a');
    expect(localStorage.getItem(key)).toBeNull();
    expect(service.pickFarm([])).toBeNull();
  });

  it('clears the selection on logout', () => {
    const service = TestBed.inject(FarmService);
    service.selectFarm('farm-a');
    service.clearSelection();
    expect(service.selectedFarmId()).toBeNull();
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('mirrors the backend role capabilities', () => {
    expect(farmCan.manageRecords('Manager')).toBe(true);
    expect(farmCan.manageRecords('Worker')).toBe(false);
    expect(farmCan.finance('Manager')).toBe(false);
    expect(farmCan.manageFarm('Owner')).toBe(true);
  });
});
