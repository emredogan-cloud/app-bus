/**
 * Storage abstraction for auth tokens. Mobile uses expo-secure-store, web uses
 * httpOnly cookies (Phase 9), tests can use the in-memory implementation.
 */
export interface TokenStore {
  get(): Promise<TokenSet | null>;
  set(tokens: TokenSet): Promise<void>;
  clear(): Promise<void>;
}

export interface TokenSet {
  access_token: string;
  refresh_token: string;
  /** Unix seconds when the access token expires (best-effort, used for proactive refresh). */
  expires_at?: number;
}

export class InMemoryTokenStore implements TokenStore {
  private tokens: TokenSet | null = null;
  async get(): Promise<TokenSet | null> {
    return this.tokens;
  }
  async set(tokens: TokenSet): Promise<void> {
    this.tokens = tokens;
  }
  async clear(): Promise<void> {
    this.tokens = null;
  }
}
