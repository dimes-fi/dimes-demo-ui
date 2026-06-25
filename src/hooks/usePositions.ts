import { usePositions as useSdkPositions } from '@dimes-dot-fi/sdk/react';
import type { PositionStatus } from '@dimes-dot-fi/sdk';
import { useAuthStore } from '../store/auth';

interface UsePositionsParams {
  sortBy?: string;
  sortDirection?: string;
  state?: 'active' | 'inactive';
  status?: string;
  expand?: string[];
}

/**
 * Thin wrapper over the SDK's `usePositions`. The SDK hook now owns what this
 * file used to hand-roll: wallet-scoped cache keys (`scope`), transient-status
 * adaptive polling, and WebSocket reconciliation (paired with the reconcile
 * mode of `usePositionStream`). We only translate the demo's param shape and
 * gate on auth.
 */
export function usePositions(params?: UsePositionsParams) {
  const jwt = useAuthStore((s) => s.jwt);
  const walletAddress = useAuthStore((s) => s.walletAddress);

  return useSdkPositions(
    {
      sortBy: params?.sortBy as 'created_at' | 'closed_at' | undefined,
      sortDirection: params?.sortDirection as 'asc' | 'desc' | undefined,
      state: params?.state,
      status: params?.status as PositionStatus | undefined,
      expand: params?.expand,
    },
    { enabled: !!jwt && !!walletAddress },
    {
      scope: walletAddress?.toLowerCase() ?? null,
      adaptivePolling: true,
      reconcile: true,
    },
  );
}
