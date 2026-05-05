import { describe, expect, it, vi } from 'vitest';
import { ApiClient } from './client.js';
import { InMemoryTokenStore } from './token-store.js';
import { ApiError } from './errors.js';

function fakeFetch(handlers: Array<(req: { url: string; init: RequestInit }) => Response>) {
  const log: Array<{ url: string; init: RequestInit }> = [];
  let i = 0;
  const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
    const entry = { url: u, init: init ?? {} };
    log.push(entry);
    const handler = handlers[i++] ?? handlers[handlers.length - 1];
    return handler(entry);
  });
  return { fetchFn, log };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('ApiClient', () => {
  const baseUrl = 'http://api.test';

  it('attaches bearer token to authenticated requests', async () => {
    const store = new InMemoryTokenStore();
    await store.set({ access_token: 'AT', refresh_token: 'RT' });

    const { fetchFn, log } = fakeFetch([() => jsonResponse(200, { id: '1', email: 'a@b' })]);
    const client = new ApiClient({ baseUrl, tokenStore: store, fetch: fetchFn as never });

    await client.getProfile();
    const headers = log[0].init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer AT');
  });

  it('refreshes once on 401, then retries', async () => {
    const store = new InMemoryTokenStore();
    await store.set({ access_token: 'expired', refresh_token: 'good-refresh' });

    const { fetchFn, log } = fakeFetch([
      // 1) first /users/me with expired access → 401
      () => jsonResponse(401, { code: 'expired', status: 401 }),
      // 2) /auth/refresh → new tokens
      () =>
        jsonResponse(200, {
          access_token: 'new-AT',
          refresh_token: 'new-RT',
          token_type: 'Bearer',
          expires_in: 900,
          user: { id: '1', email: 'a@b' },
        }),
      // 3) retry /users/me with new AT → ok
      () => jsonResponse(200, { id: '1', email: 'a@b' }),
    ]);
    const client = new ApiClient({ baseUrl, tokenStore: store, fetch: fetchFn as never });

    const profile = await client.getProfile();
    expect(profile).toEqual({ id: '1', email: 'a@b' });
    expect(log[2].init.headers).toMatchObject({ authorization: 'Bearer new-AT' });

    const stored = await store.get();
    expect(stored?.access_token).toBe('new-AT');
    expect(stored?.refresh_token).toBe('new-RT');
  });

  it('coalesces concurrent 401-driven refreshes into a single /auth/refresh call', async () => {
    const store = new InMemoryTokenStore();
    await store.set({ access_token: 'expired', refresh_token: 'good-refresh' });

    let refreshCalls = 0;
    let secondCalls = 0;
    const fetchFn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      if (u.endsWith('/v1/auth/refresh')) {
        refreshCalls++;
        // Tiny delay to simulate I/O so the two retries truly overlap
        await new Promise((r) => setTimeout(r, 5));
        return jsonResponse(200, {
          access_token: 'new-AT',
          refresh_token: 'new-RT',
          token_type: 'Bearer',
          expires_in: 900,
          user: { id: '1', email: 'a@b' },
        });
      }
      if (u.endsWith('/v1/users/me')) {
        const headers = (init?.headers ?? {}) as Record<string, string>;
        if (headers.authorization === 'Bearer expired') {
          return jsonResponse(401, { code: 'expired', status: 401 });
        }
        secondCalls++;
        return jsonResponse(200, { id: '1', email: 'a@b' });
      }
      return jsonResponse(404, { code: 'unknown_url', status: 404 });
    });

    const client = new ApiClient({ baseUrl, tokenStore: store, fetch: fetchFn as never });
    await Promise.all([client.getProfile(), client.getProfile(), client.getProfile()]);

    expect(refreshCalls).toBe(1);
    expect(secondCalls).toBe(3);
  });

  it('throws ApiError with status + problem on non-401 errors', async () => {
    const store = new InMemoryTokenStore();
    await store.set({ access_token: 'AT', refresh_token: 'RT' });
    const { fetchFn } = fakeFetch([() => jsonResponse(409, { code: 'email_taken', status: 409 })]);
    const client = new ApiClient({ baseUrl, tokenStore: store, fetch: fetchFn as never });
    try {
      await client.getProfile();
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(409);
      expect((err as ApiError).problem.code).toBe('email_taken');
    }
  });

  it('clears tokens on logout', async () => {
    const store = new InMemoryTokenStore();
    await store.set({ access_token: 'AT', refresh_token: 'RT' });
    const { fetchFn } = fakeFetch([() => new Response(null, { status: 204 })]);
    const client = new ApiClient({ baseUrl, tokenStore: store, fetch: fetchFn as never });
    await client.logout();
    expect(await store.get()).toBeNull();
  });
});
