import type { RegisterRequest, LoginRequest, TokenPair, UserProfile } from '@app-bus/types';
import { ApiError, NetworkError, type ProblemDetailsError } from './errors.js';
import type { TokenStore, TokenSet } from './token-store.js';

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  /** Hook called after a successful refresh fails — clears local session UI. */
  onUnauthenticated?: () => void;
  /** Optional fetch override (e.g. expo's fetch). */
  fetch?: typeof globalThis.fetch;
}

interface RequestInit2 {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Skip the auth header even if a token is present. Used by /auth/* endpoints. */
  unauthenticated?: boolean;
  /** Internal: marks the call as a retry to prevent infinite refresh loops. */
  _isRetry?: boolean;
}

export class ApiClient {
  private refreshInFlight: Promise<TokenSet | null> | null = null;
  private fetch: typeof globalThis.fetch;

  constructor(private readonly opts: ApiClientOptions) {
    this.fetch = opts.fetch ?? globalThis.fetch.bind(globalThis);
  }

  // ── Auth endpoints ──────────────────────────────────────────────────────
  async register(
    input: RegisterRequest & { marketing_opt_in?: boolean },
  ): Promise<TokenPair & { user: UserProfile }> {
    const out = await this.request<TokenPair & { user: UserProfile }>('/v1/auth/register', {
      method: 'POST',
      body: input,
      unauthenticated: true,
    });
    await this.opts.tokenStore.set({
      access_token: out.access_token,
      refresh_token: out.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + out.expires_in,
    });
    return out;
  }

  async login(input: LoginRequest): Promise<TokenPair & { user: UserProfile }> {
    const out = await this.request<TokenPair & { user: UserProfile }>('/v1/auth/login', {
      method: 'POST',
      body: input,
      unauthenticated: true,
    });
    await this.opts.tokenStore.set({
      access_token: out.access_token,
      refresh_token: out.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + out.expires_in,
    });
    return out;
  }

  async logout(): Promise<void> {
    const tokens = await this.opts.tokenStore.get();
    if (tokens) {
      try {
        await this.request<void>('/v1/auth/logout', {
          method: 'POST',
          body: { refresh_token: tokens.refresh_token },
          unauthenticated: true,
        });
      } catch {
        // Logout is best-effort — even if the server is down, we clear local state.
      }
    }
    await this.opts.tokenStore.clear();
  }

  async forgotPassword(email: string): Promise<void> {
    await this.request<void>('/v1/auth/forgot-password', {
      method: 'POST',
      body: { email },
      unauthenticated: true,
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.request<void>('/v1/auth/reset-password', {
      method: 'POST',
      body: { token, new_password: newPassword },
      unauthenticated: true,
    });
  }

  async signInWithGoogle(input: {
    id_token: string;
    kvkk_consent_version?: string;
    marketing_opt_in?: boolean;
  }): Promise<TokenPair & { user: UserProfile }> {
    const out = await this.request<TokenPair & { user: UserProfile }>('/v1/auth/oauth/google', {
      method: 'POST',
      body: input,
      unauthenticated: true,
    });
    await this.opts.tokenStore.set({
      access_token: out.access_token,
      refresh_token: out.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + out.expires_in,
    });
    return out;
  }

  async signInWithApple(input: {
    id_token: string;
    kvkk_consent_version?: string;
    marketing_opt_in?: boolean;
  }): Promise<TokenPair & { user: UserProfile }> {
    const out = await this.request<TokenPair & { user: UserProfile }>('/v1/auth/oauth/apple', {
      method: 'POST',
      body: input,
      unauthenticated: true,
    });
    await this.opts.tokenStore.set({
      access_token: out.access_token,
      refresh_token: out.refresh_token,
      expires_at: Math.floor(Date.now() / 1000) + out.expires_in,
    });
    return out;
  }

  // ── User endpoints ─────────────────────────────────────────────────────
  getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/v1/users/me', { method: 'GET' });
  }

  updateProfile(
    patch: Partial<{ name: string; locale: 'tr' | 'en'; phone_e164: string | null }>,
  ): Promise<UserProfile> {
    return this.request<UserProfile>('/v1/users/me', { method: 'PATCH', body: patch });
  }

  deleteAccount(): Promise<void> {
    return this.request<void>('/v1/users/me', { method: 'DELETE' });
  }

  exportData(): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>('/v1/users/me/export', { method: 'GET' });
  }

  // ── Internal: request + refresh interceptor ────────────────────────────
  async request<T>(path: string, init: RequestInit2 = {}): Promise<T> {
    const url = this.buildUrl(path, init.query);
    const tokens = init.unauthenticated ? null : await this.opts.tokenStore.get();

    const headers: Record<string, string> = {
      accept: 'application/json',
    };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    if (tokens?.access_token) headers['authorization'] = `Bearer ${tokens.access_token}`;

    let res: Response;
    try {
      res = await this.fetch(url, {
        method: init.method ?? 'GET',
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch (err) {
      throw new NetworkError(err);
    }

    // 401 → try refresh once.
    if (res.status === 401 && !init.unauthenticated && !init._isRetry) {
      const refreshed = await this.refreshOnce();
      if (refreshed) {
        return this.request<T>(path, { ...init, _isRetry: true });
      }
      this.opts.onUnauthenticated?.();
    }

    if (res.status === 204) return undefined as T;

    let body: unknown;
    const text = await res.text();
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    if (!res.ok) {
      const problem: ProblemDetailsError =
        body && typeof body === 'object'
          ? (body as ProblemDetailsError)
          : { status: res.status, detail: typeof body === 'string' ? body : 'request failed' };
      throw new ApiError(problem, res.status);
    }

    return body as T;
  }

  /**
   * Single-flight refresh: concurrent 401s coalesce into one /refresh call.
   * Returns the new tokens or null if refresh fails.
   */
  private async refreshOnce(): Promise<TokenSet | null> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = (async () => {
      const tokens = await this.opts.tokenStore.get();
      if (!tokens?.refresh_token) return null;

      try {
        const res = await this.request<TokenPair & { user: UserProfile }>('/v1/auth/refresh', {
          method: 'POST',
          body: { refresh_token: tokens.refresh_token },
          unauthenticated: true,
          _isRetry: true,
        });
        const next: TokenSet = {
          access_token: res.access_token,
          refresh_token: res.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + res.expires_in,
        };
        await this.opts.tokenStore.set(next);
        return next;
      } catch {
        await this.opts.tokenStore.clear();
        return null;
      }
    })();

    try {
      return await this.refreshInFlight;
    } finally {
      this.refreshInFlight = null;
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | undefined>): string {
    const base = this.opts.baseUrl.replace(/\/$/, '');
    const url = new URL(`${base}${path}`);
    for (const [k, v] of Object.entries(query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
    return url.toString();
  }
}
