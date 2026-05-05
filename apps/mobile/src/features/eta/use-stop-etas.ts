import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/shared/api';

type EtaItem = Awaited<ReturnType<typeof apiClient.stopEtas>>['items'][number];

/**
 * Polls /v1/stops/:id/etas every 15s while mounted. The endpoint itself is
 * cached at the edge with `Cache-Control: max-age=15, swr=30` so this stays
 * cheap.
 */
export function useStopEtas(stopId: string | undefined): EtaItem[] | null {
  const [items, setItems] = useState<EtaItem[] | null>(null);
  const aborted = useRef(false);

  useEffect(() => {
    if (!stopId) return;
    aborted.current = false;
    const fetchOnce = async () => {
      try {
        const res = await apiClient.stopEtas(stopId, { limit: 10 });
        if (!aborted.current) setItems(res.items);
      } catch {
        // soft fail — UI shows last good list
      }
    };
    fetchOnce();
    const t = setInterval(fetchOnce, 15_000);
    return () => {
      aborted.current = true;
      clearInterval(t);
    };
  }, [stopId]);

  return items;
}
