import { describe, expect, it } from 'vitest';
import { LocaleSchema, CityCodeSchema, PaginationSchema, ProblemDetailsSchema } from './common.js';

describe('common schemas', () => {
  it('accepts known locales', () => {
    expect(LocaleSchema.parse('tr')).toBe('tr');
    expect(LocaleSchema.parse('en')).toBe('en');
  });

  it('rejects unknown locale', () => {
    expect(() => LocaleSchema.parse('de')).toThrow();
  });

  it('city codes are limited to MVP cities', () => {
    expect(CityCodeSchema.parse('IST')).toBe('IST');
    expect(CityCodeSchema.parse('ANK')).toBe('ANK');
    expect(() => CityCodeSchema.parse('IZM')).toThrow();
  });

  it('pagination caps limit at 100', () => {
    expect(() => PaginationSchema.parse({ limit: 101 })).toThrow();
    expect(PaginationSchema.parse({}).limit).toBe(20);
  });

  it('problem details requires URL type', () => {
    const valid = {
      type: 'https://api.app-bus.tr/problems/not-found',
      title: 'Not Found',
      status: 404,
    };
    expect(ProblemDetailsSchema.parse(valid)).toEqual(valid);
  });
});
