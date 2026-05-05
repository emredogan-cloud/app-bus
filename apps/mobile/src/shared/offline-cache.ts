import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * MMKV-backed offline cache. Used for:
 *   • favorites snapshot (so Favorites screen renders offline)
 *   • recently viewed stops (last 50)
 *   • last known ETAs per stop (with timestamp; UI shows "Last updated Xm ago")
 *
 * MMKV is ~30x faster than AsyncStorage and supports synchronous reads, which
 * lets components hydrate without a loading spinner on cold start.
 */
const store: MMKV = createMMKV({ id: 'app-bus.offline.v1' });

export interface CachedEntry<T> {
  value: T;
  cachedAt: number;
}

export const offlineCache = {
  set<T>(key: string, value: T): void {
    const entry: CachedEntry<T> = { value, cachedAt: Date.now() };
    store.set(key, JSON.stringify(entry));
  },
  get<T>(key: string): CachedEntry<T> | null {
    const raw = store.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedEntry<T>;
    } catch {
      store.remove(key);
      return null;
    }
  },
  delete(key: string): void {
    store.remove(key);
  },
  clear(): void {
    store.clearAll();
  },
};

export const cacheKeys = {
  favorites: 'favorites',
  recentStops: 'recent-stops',
  stopEtas: (id: string) => `etas:${id}`,
} as const;
