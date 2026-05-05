import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';
import { tokenStore } from '@/shared/api';

export interface VehicleUpdate {
  vehicle_id: string;
  route_external_id: string;
  city: 'IST' | 'ANK';
  lat: number;
  lng: number;
  speed_kmh: number;
  heading: number;
  recorded_at: string;
}

export interface SubscribeRoute {
  kind: 'route';
  city: 'IST' | 'ANK';
  route_external_id: string;
}
export interface SubscribeBbox {
  kind: 'bbox';
  city?: 'IST' | 'ANK';
  bbox: [number, number, number, number];
}
export type SubscribeRequest = SubscribeRoute | SubscribeBbox;

type Listener = (sub_id: string, vehicle: VehicleUpdate) => void;

const apiUrl =
  (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:3000';

/**
 * Singleton Socket.IO connection to /v1/live with:
 *   • exponential reconnect (1, 2, 5, 10, 30s) capped at 30s with jitter
 *   • auto-resubscribe on reconnect
 *   • shared single connection — all hooks reference one socket
 */
class LiveSocket {
  private socket: Socket | null = null;
  private subs = new Map<string, { req: SubscribeRequest; listener: Listener }>();
  private clientToServerSubId = new Map<string, string>();

  private getSocket(): Socket {
    if (this.socket && this.socket.connected) return this.socket;
    if (!this.socket) {
      this.socket = io(`${apiUrl}/live`, {
        autoConnect: true,
        transports: ['websocket'],
        // Backoff handled by socket.io with our chosen bounds
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
        randomizationFactor: 0.5,
        auth: async (cb) => {
          const tokens = await tokenStore.get();
          cb({ token: tokens?.access_token ?? null });
        },
      });

      this.socket.on('connect', () => {
        // Re-subscribe everything that was active prior to disconnect
        for (const [clientSubId, { req }] of this.subs) {
          this.socket!.emit('subscribe', req, (ack: { sub_id?: string; error?: string }) => {
            if (ack?.sub_id) this.clientToServerSubId.set(clientSubId, ack.sub_id);
          });
        }
      });

      this.socket.on('update', (msg: { sub_id: string; vehicle: VehicleUpdate }) => {
        for (const [clientSubId, { listener }] of this.subs) {
          if (this.clientToServerSubId.get(clientSubId) === msg.sub_id) {
            listener(clientSubId, msg.vehicle);
          }
        }
      });
    }
    return this.socket;
  }

  subscribe(req: SubscribeRequest, listener: Listener): () => void {
    const clientSubId = `c${Math.random().toString(36).slice(2, 10)}`;
    this.subs.set(clientSubId, { req, listener });

    const s = this.getSocket();
    if (s.connected) {
      s.emit('subscribe', req, (ack: { sub_id?: string; error?: string }) => {
        if (ack?.sub_id) this.clientToServerSubId.set(clientSubId, ack.sub_id);
      });
    }

    return () => {
      const serverSubId = this.clientToServerSubId.get(clientSubId);
      this.subs.delete(clientSubId);
      this.clientToServerSubId.delete(clientSubId);
      if (serverSubId && this.socket?.connected) {
        this.socket.emit('unsubscribe', { sub_id: serverSubId });
      }
      // If no more subs, keep the socket open — reconnects on next sub anyway
    };
  }

  pause(): void {
    this.socket?.disconnect();
  }
  resume(): void {
    this.socket?.connect();
  }

  destroy(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.subs.clear();
    this.clientToServerSubId.clear();
  }
}

export const liveSocket = new LiveSocket();
