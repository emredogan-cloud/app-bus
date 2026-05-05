import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { liveSocket } from './live-socket.js';
import type { SubscribeRequest, VehicleUpdate } from './live-socket.js';

interface InternalVehicle extends VehicleUpdate {
  /** When the client received the update — used for stale detection in UI. */
  client_received_at: number;
}

const STALE_AFTER_MS = 60_000;

/**
 * useLiveVehicles — React hook that returns the latest known position for each
 * vehicle matching the subscription. Updates are coalesced at 10Hz on the
 * client side (regardless of server cadence) to prevent re-render storms.
 */
export function useLiveVehicles(req: SubscribeRequest | null): InternalVehicle[] {
  const [vehicles, setVehicles] = useState<Map<string, InternalVehicle>>(new Map());
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!req) return;

    const update = (next: Map<string, InternalVehicle>) => {
      if (pendingRef.current) return;
      pendingRef.current = true;
      // 10Hz throttle
      setTimeout(() => {
        pendingRef.current = false;
        setVehicles(new Map(next));
      }, 100);
    };

    const live = new Map<string, InternalVehicle>();
    const off = liveSocket.subscribe(req, (_subId, v) => {
      live.set(v.vehicle_id, { ...v, client_received_at: Date.now() });
      update(live);
    });

    // Pause the socket when the app backgrounds; resume on foreground.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') liveSocket.resume();
      else liveSocket.pause();
    });

    return () => {
      off();
      sub.remove();
    };
  }, [JSON.stringify(req)]);

  // Drop stale vehicles every few seconds — Phase 4 simple version.
  useEffect(() => {
    const t = setInterval(() => {
      setVehicles((prev) => {
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of prev) {
          if (now - v.client_received_at > STALE_AFTER_MS * 2) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 10_000);
    return () => clearInterval(t);
  }, []);

  return Array.from(vehicles.values());
}

export type { VehicleUpdate, SubscribeRequest };
export { STALE_AFTER_MS };
