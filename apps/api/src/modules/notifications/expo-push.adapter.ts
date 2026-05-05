import { Injectable, Logger } from '@nestjs/common';

export interface ExpoPushMessage {
  to: string; // ExponentPushToken[…]
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  /** Semantic error code from Expo: 'DeviceNotRegistered' triggers token cleanup. */
  details?: { error?: string };
}

const EXPO_ENDPOINT = 'https://exp.host/--/api/v2/push/send';

/**
 * Expo Push Notification adapter. Production uses real HTTP; in tests we mock
 * via process.env.NODE_ENV='test' to keep CI deterministic.
 *
 * Note: Apple/Google direct send (FCM + APNs) lands in Phase 8 monetization,
 * once we have a paid Apple developer account configured. Expo Push is fine
 * for the closed beta launch (Phase 7).
 */
@Injectable()
export class ExpoPushAdapter {
  private readonly log = new Logger(ExpoPushAdapter.name);

  async sendBatch(messages: ExpoPushMessage[]): Promise<ExpoPushReceipt[]> {
    if (messages.length === 0) return [];
    if (process.env.NODE_ENV === 'test') {
      return messages.map((_, i) => ({ status: 'ok', id: `test-${i}` }));
    }
    try {
      const res = await fetch(EXPO_ENDPOINT, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'accept-encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        this.log.warn(`expo push HTTP ${res.status}`);
        return messages.map(() => ({ status: 'error', message: `http_${res.status}` }));
      }
      const json = (await res.json()) as { data?: ExpoPushReceipt[] };
      return json.data ?? [];
    } catch (err) {
      this.log.error(`expo push failed: ${(err as Error).message}`);
      return messages.map(() => ({ status: 'error', message: 'network' }));
    }
  }
}
