import { useQuery } from '@tanstack/react-query'
import { DimesClient } from '@dimes-dot-fi/sdk'
import type { FeeRates } from '../api/types'
import { useAuthStore } from '../store/auth'
import { getApiBase } from '../runtimeConfig'

const FEE_RATES_STALE_MS = 30 * 60 * 1000 // 30 min — fee rates change rarely

/**
 * Fetches the protocol fee schedule + this partner's fee components (and, when a
 * ticker is given, the market's venue fee fields) so the trade panel can compute
 * an offer estimate client-side via the SDK math before requesting a quote.
 */
export function useFeeRates(ticker?: string) {
  const jwt = useAuthStore((s) => s.jwt)

  return useQuery<FeeRates>({
    queryKey: ['fee-rates', ticker ?? null],
    queryFn: () => {
      const client = new DimesClient({
        baseUrl: getApiBase(),
        auth: {
          getHeaders: async (): Promise<Record<string, string>> =>
            jwt ? { Authorization: `Bearer ${jwt}` } : {},
        },
      })
      return client.getFeeRates(ticker ? { ticker } : undefined)
    },
    enabled: !!jwt,
    staleTime: FEE_RATES_STALE_MS,
  })
}
