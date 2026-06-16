import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchMarkets } from '../api/markets'
import { useAuthStore } from '../store/auth'
import { useLiveMarketsStore } from '../store/liveMarkets'

const SEED_LIMIT = 20

/**
 * Seeds the live-additions strip with the newest-discovered markets via REST
 * (sort=discovered_at_desc) so the strip isn't empty between sparse websocket
 * discoveries. The socket then tops it up live during the session.
 *
 * Tolerant by design: if the backend hasn't shipped discovery-date sorting yet
 * the request errors and we simply seed nothing — the strip falls back to
 * websocket-only behavior.
 */
export function useSeedLiveMarkets() {
  const jwt = useAuthStore((s) => s.jwt)

  const { data } = useQuery({
    queryKey: ['markets-seed', 'discovered_at_desc'],
    queryFn: () =>
      fetchMarkets({
        sort: 'discovered_at_desc',
        acceptingNewPositions: true,
        limit: SEED_LIMIT,
        expand: ['prices'],
      }),
    enabled: !!jwt,
    staleTime: 5 * 60_000,
    retry: false,
  })

  useEffect(() => {
    if (data?.data?.length) {
      useLiveMarketsStore.getState().add(data.data)
    }
  }, [data])
}
