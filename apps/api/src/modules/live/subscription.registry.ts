import { Injectable, Logger } from '@nestjs/common';
import type { SubscribeRequest, VehicleUpdate } from './types.js';
import { bboxContains } from './types.js';

interface RouteSub {
  kind: 'route';
  city: 'IST' | 'ANK';
  route_external_id: string;
}

interface BboxSub {
  kind: 'bbox';
  city?: 'IST' | 'ANK';
  bbox: [number, number, number, number];
}

export type Subscription = (RouteSub | BboxSub) & { sub_id: string };

interface ClientState {
  socketId: string;
  subs: Map<string, Subscription>;
  /** When the connection started — used for anonymous-session limits. */
  startedAt: number;
}

/**
 * In-process registry of active subscriptions per socket.
 *
 * Bigger than this — say >5k connections per pod — should be backed by Redis
 * (the @socket.io/redis-adapter handles fan-out across pods). Even then, the
 * per-socket subscription state is local; only message routing is shared.
 */
@Injectable()
export class SubscriptionRegistry {
  private readonly log = new Logger(SubscriptionRegistry.name);
  private readonly clients = new Map<string, ClientState>();

  attach(socketId: string): void {
    this.clients.set(socketId, { socketId, subs: new Map(), startedAt: Date.now() });
  }

  detach(socketId: string): void {
    this.clients.delete(socketId);
  }

  size(): number {
    return this.clients.size;
  }

  /** Add a subscription. Returns the assigned sub_id. */
  add(socketId: string, req: SubscribeRequest, max = 50): { sub_id: string } | { error: string } {
    const cs = this.clients.get(socketId);
    if (!cs) return { error: 'no_connection' };
    if (cs.subs.size >= max) return { error: 'subscription_limit' };
    const sub_id = `${socketId}:${cs.subs.size + 1}`;
    cs.subs.set(sub_id, { sub_id, ...req } as Subscription);
    return { sub_id };
  }

  remove(socketId: string, sub_id: string): boolean {
    return this.clients.get(socketId)?.subs.delete(sub_id) ?? false;
  }

  /**
   * For an incoming Position update, compute which (socketId, sub_id) pairs match.
   */
  match(update: VehicleUpdate): Array<{ socketId: string; sub_id: string }> {
    const out: Array<{ socketId: string; sub_id: string }> = [];
    for (const cs of this.clients.values()) {
      for (const sub of cs.subs.values()) {
        if (sub.kind === 'route') {
          if (sub.city === update.city && sub.route_external_id === update.route_external_id) {
            out.push({ socketId: cs.socketId, sub_id: sub.sub_id });
          }
        } else if (sub.kind === 'bbox') {
          if (sub.city && sub.city !== update.city) continue;
          if (bboxContains(sub.bbox, update.lat, update.lng)) {
            out.push({ socketId: cs.socketId, sub_id: sub.sub_id });
          }
        }
      }
    }
    return out;
  }
}
