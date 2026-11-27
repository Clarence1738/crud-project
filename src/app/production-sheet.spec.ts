import { appliesTo, defaultSession } from './production-sheet';

describe('production sheet helpers', () => {
  it('lists the animals a measure usually applies to', () => {
    expect(appliesTo('Milk', { species: 'Dairy cattle', sex: 'Female' })).toBe(true);
    expect(appliesTo('Milk', { species: 'Dairy cattle', sex: 'Male' })).toBe(false);
    expect(appliesTo('Milk', { species: 'Poultry', sex: 'Female' })).toBe(false);
    expect(appliesTo('Eggs', { species: 'Poultry', sex: 'Mixed' })).toBe(true);
    expect(appliesTo('Wool', { species: 'Goats', sex: 'Female' })).toBe(false);
    expect(appliesTo('Weight', { species: 'Goats', sex: 'Male' })).toBe(true);
  });

  it('picks the milking session from the Nairobi time of day', () => {
    expect(defaultSession(new Date('2026-11-27T04:30:00Z'))).toBe('Morning'); // 07:30 Nairobi
    expect(defaultSession(new Date('2026-11-27T13:00:00Z'))).toBe('Evening'); // 16:00 Nairobi
  });
});
