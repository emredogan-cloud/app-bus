import { dedupeStops } from './dedupe.js';
import type { GtfsStop } from './parser.js';

const baseStop = (over: Partial<GtfsStop>): GtfsStop => ({
  stop_id: 'A',
  stop_name: 'Taksim',
  stop_lat: 41.036,
  stop_lon: 28.985,
  ...over,
});

describe('dedupeStops', () => {
  it('collapses two same-name stops within 30m to one canonical', () => {
    const stops: GtfsStop[] = [
      baseStop({ stop_id: 'A', stop_lat: 41.036, stop_lon: 28.985 }),
      // ~25m east of A
      baseStop({ stop_id: 'B', stop_lat: 41.036, stop_lon: 28.9853 }),
    ];
    const { canonical, mapping } = dedupeStops(stops);
    expect(canonical).toHaveLength(1);
    expect(canonical[0].stop_id).toBe('A');
    expect(mapping.get('A')).toBe('A');
    expect(mapping.get('B')).toBe('A');
  });

  it('keeps far-apart same-name stops separate', () => {
    const stops: GtfsStop[] = [
      baseStop({ stop_id: 'A', stop_lat: 41.036, stop_lon: 28.985 }),
      // ~1km north
      baseStop({ stop_id: 'B', stop_lat: 41.045, stop_lon: 28.985 }),
    ];
    const { canonical, mapping } = dedupeStops(stops);
    expect(canonical).toHaveLength(2);
    expect(mapping.get('A')).toBe('A');
    expect(mapping.get('B')).toBe('B');
  });

  it('handles Turkish characters in canonical name (case + diacritic insensitive)', () => {
    const stops: GtfsStop[] = [
      baseStop({ stop_id: 'A', stop_name: 'Kadıköy İskele', stop_lat: 40.99, stop_lon: 29.024 }),
      baseStop({ stop_id: 'B', stop_name: 'KADIKOY ISKELE', stop_lat: 40.99, stop_lon: 29.0241 }),
    ];
    const { canonical, mapping } = dedupeStops(stops);
    expect(canonical).toHaveLength(1);
    expect(mapping.get('B')).toBe('A');
  });

  it('does not collapse different-name stops even if co-located', () => {
    const stops: GtfsStop[] = [
      baseStop({ stop_id: 'A', stop_name: 'Eminönü', stop_lat: 41.017, stop_lon: 28.97 }),
      baseStop({ stop_id: 'B', stop_name: 'Sirkeci', stop_lat: 41.0171, stop_lon: 28.9701 }),
    ];
    const { canonical } = dedupeStops(stops);
    expect(canonical).toHaveLength(2);
  });
});
