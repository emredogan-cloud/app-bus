import { ApiClient, InMemoryTokenStore } from '@app-bus/api-client';

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * Server-side helper for unauthenticated calls (public stop pages, etc.).
 * Authenticated calls live in route handlers under app/api/* and use httpOnly
 * cookie-backed tokens (Phase 9 follow-up).
 */
export const publicApi = new ApiClient({
  baseUrl,
  tokenStore: new InMemoryTokenStore(),
});
