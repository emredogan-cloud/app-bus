import { etaColor, formatEta } from '../format-eta';

describe('formatEta', () => {
  it('returns Now / Şimdi under 60s', () => {
    expect(formatEta(30, 0, 'en')).toBe('Now');
    expect(formatEta(30, 0, 'tr')).toBe('Şimdi');
  });

  it('formats minutes between 1 and 59', () => {
    expect(formatEta(120, 0, 'en')).toBe('2 min');
    expect(formatEta(120, 0, 'tr')).toBe('2 dk');
  });

  it('formats HH:MM for >=1h', () => {
    const t = new Date('2026-05-05T12:34:00Z').getTime() / 1000;
    const out = formatEta(3700, t, 'en');
    expect(out).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('etaColor', () => {
  it('urgent under 2 min', () => expect(etaColor(60)).toBe('urgent'));
  it('soon 2-5 min', () => expect(etaColor(180)).toBe('soon'));
  it('normal beyond 5 min', () => expect(etaColor(600)).toBe('normal'));
});
