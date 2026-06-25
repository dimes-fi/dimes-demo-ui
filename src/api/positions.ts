import type { PositionStatus } from '@dimes-dot-fi/sdk';
import { getDimesClient } from './dimesClient';
import type { ContractInfo, Position } from './types';

interface FetchPositionsParams {
  sortBy?: string;
  sortDirection?: string;
  state?: 'active' | 'inactive';
  status?: string;
  expand?: string[];
}

export async function fetchPositions(params?: FetchPositionsParams): Promise<Position[]> {
  return getDimesClient().getPositions({
    sortBy: params?.sortBy as 'created_at' | 'closed_at' | undefined,
    sortDirection: params?.sortDirection as 'asc' | 'desc' | undefined,
    state: params?.state,
    status: params?.status as PositionStatus | undefined,
    expand: params?.expand,
  });
}

export async function cancelPosition(positionId: string): Promise<void> {
  return getDimesClient().cancelPosition(positionId);
}

export async function fetchContractInfo(): Promise<ContractInfo> {
  return getDimesClient().getContractInfo();
}
