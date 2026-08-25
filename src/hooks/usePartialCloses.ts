import { useQuery } from '@tanstack/react-query';
import { fetchPartialCloses } from '../api/positions';
import { useAuthStore } from '../store/auth';

const DEFAULT_RETRIES = 3;
const BETA_FEATURE_NOT_ENABLED = 'beta_feature_not_enabled';

// Partial close is a beta feature enabled per partner. When it is off for this API key the endpoint
// answers 400 beta_feature_not_enabled for every position, permanently — retrying only burns requests.
function isBetaFeatureRejection(error: unknown): boolean {
  return (
    error != null &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: unknown }).code === BETA_FEATURE_NOT_ENABLED
  );
}

export function usePartialCloses(positionId: string | null | undefined) {
  const jwt = useAuthStore((s) => s.jwt);

  return useQuery({
    queryKey: ['partial-closes', positionId],
    queryFn: () => fetchPartialCloses(positionId as string),
    enabled: !!jwt && !!positionId,
    retry: (failureCount, error) => !isBetaFeatureRejection(error) && failureCount < DEFAULT_RETRIES,
  });
}
