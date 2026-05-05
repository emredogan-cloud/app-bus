import { CITIES, nearestCity } from '../cities';

describe('CITIES', () => {
  it('lists 5 MVP cities', () => {
    expect(CITIES.map((c) => c.code)).toEqual(['IST', 'ANK', 'IZM', 'BUR', 'ANT']);
  });
});

describe('nearestCity', () => {
  it('Kadıköy → IST', () => {
    expect(nearestCity(40.99, 29.025)).toBe('IST');
  });
  it('Çankaya → ANK', () => {
    expect(nearestCity(39.918, 32.86)).toBe('ANK');
  });
  it('Konak → IZM', () => {
    expect(nearestCity(38.42, 27.13)).toBe('IZM');
  });
  it('Lara → ANT', () => {
    expect(nearestCity(36.85, 30.79)).toBe('ANT');
  });
});
