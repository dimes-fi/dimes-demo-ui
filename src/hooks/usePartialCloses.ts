import { useQuery } from '@tanstack/react-query';
import { fetchPartialCloses } from '../api/positions';
import { useAuthStore } from '../store/auth';

export function usePartialCloses(positionId: string | null | undefined) {
  const jwt = useAuthStore((s) => s.jwt);

  return useQuery({
    queryKey: ['partial-closes', positionId],
    queryFn: () => fetchPartialCloses(positionId as string),
    enabled: !!jwt && !!positionId,
  });
}
