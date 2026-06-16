import { useQuery } from '@tanstack/react-query';
import { fetchPositions } from '../api/positions';
import type { Position } from '../api/types';
import { useAuthStore } from '../store/auth';
import { wsTimestamps } from './usePositionSocket';

interface UsePositionsParams {
  sortBy?: string;
  sortDirection?: string;
  state?: 'active' | 'inactive';
  status?: string;
  expand?: string[];
}

const FAST_POLL_MS = 5_000;
const SLOW_POLL_MS = 15_000;
const RECONCILIATION_WINDOW_MS = 12_000;

export function usePositions(params?: UsePositionsParams) {
  const jwt = useAuthStore((s) => s.jwt);
  const expandKey = params?.expand?.join(',') ?? '';

  return useQuery({
    queryKey: ['positions', params?.sortBy, params?.sortDirection, params?.state, params?.status, expandKey],
    queryFn: () => fetchPositions(params),
    enabled: !!jwt,
    refetchInterval: (query) => {
      const data = query.state.data as Position[] | undefined;
      if (data?.some((p) => p.status === 'pending' || p.status === 'closing' || p.status === 'settling' || p.status === 'unwinding')) return FAST_POLL_MS;
      return SLOW_POLL_MS;
    },
    structuralSharing: (oldData, newData) => {
      if (!oldData || !Array.isArray(oldData) || !Array.isArray(newData)) return newData as Position[];
      const now = Date.now();
      return (newData as Position[]).map((pollPos) => {
        const wsTime = wsTimestamps.get(pollPos.id);
        if (wsTime && now - wsTime < RECONCILIATION_WINDOW_MS) {
          const oldPos = (oldData as Position[]).find((p) => p.id === pollPos.id);
          return oldPos ?? pollPos;
        }
        if (wsTime) wsTimestamps.delete(pollPos.id);
        return pollPos;
      });
    },
  });
}
