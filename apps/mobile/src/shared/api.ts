import { ApiClient } from '@app-bus/api-client';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type { TokenStore, TokenSet } from '@app-bus/api-client';

/**
 * SecureStore-backed token store for the mobile app.
 *
 * iOS uses Keychain, Android uses encrypted SharedPreferences. SecureStore has
 * a 2KB limit per item, but our access+refresh tokens are well under that.
 */
class SecureTokenStore implements TokenStore {
  private static readonly KEY = 'app-bus.tokens';

  async get(): Promise<TokenSet | null> {
    const raw = await SecureStore.getItemAsync(SecureTokenStore.KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenSet;
    } catch {
      await SecureStore.deleteItemAsync(SecureTokenStore.KEY);
      return null;
    }
  }

  async set(tokens: TokenSet): Promise<void> {
    await SecureStore.setItemAsync(SecureTokenStore.KEY, JSON.stringify(tokens), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  }

  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(SecureTokenStore.KEY);
  }
}

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000';

export const tokenStore = new SecureTokenStore();
export const apiClient = new ApiClient({
  baseUrl: apiUrl,
  tokenStore,
  onUnauthenticated: () => {
    // The auth provider listens to this and routes back to /auth/welcome.
    onUnauthenticatedListeners.forEach((cb) => cb());
  },
});

const onUnauthenticatedListeners = new Set<() => void>();
export function onUnauthenticated(cb: () => void): () => void {
  onUnauthenticatedListeners.add(cb);
  return () => onUnauthenticatedListeners.delete(cb);
}
