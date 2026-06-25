import { useMarketStream } from '@dimes-dot-fi/sdk/react'
import type { MarketDelta, MarketEvent } from '@dimes-dot-fi/sdk/ws'
import type { Market } from '../api/types'
import { useAuthStore } from '../store/auth'
import { useLiveMarketsStore } from '../store/liveMarkets'
import { useToastStore } from '../store/toasts'

// Toast the markets that just became available to trade. Mirrors the old
// live-strip signal: only markets accepting offers, never bare discoveries.
function notifyAccepting(markets: Market[]): void {
  if (markets.length === 0) return
  useToastStore.getState().add({
    title: markets.length === 1 ? 'New market live' : `${markets.length} new markets live`,
    description: markets.length === 1 ? (markets[0].title ?? markets[0].ticker) : undefined,
    variant: 'info',
    durationMs: 5000,
  })
}

/**
 * Live market updates. The SDK's `useMarketStream` (reconcile mode) owns the
 * socket lifecycle and deep-merges eligibility / max-leverage deltas into the
 * `useMarkets` table cache (`['dimes','markets']`). This hook only adds the
 * demo-specific routing: newly-discovered markets go to the live-strip store,
 * and a toast fires when a market starts accepting positions.
 */
export function useMarketSocket() {
  const walletAddress = useAuthStore((s) => s.walletAddress)

  useMarketStream({
    enabled: !!walletAddress,
    mode: 'reconcile',
    onEvent: (event: MarketEvent) => {
      // Newly-discovered markets do NOT belong in the paginated, server-sorted,
      // server-filtered list cache (the SDK reconcile deliberately skips them).
      // Route them to the live-additions store; the strip applies active filters.
      if (event.type === 'market.discovered') {
        const discovered = event.data as Market[]
        useLiveMarketsStore.getState().add(discovered)
        // Toast only discoveries already accepting offers — most are not yet,
        // so toasting every one is far too noisy. The rest are caught on their
        // accepting-flip delta below.
        notifyAccepting(discovered.filter((m) => m.acceptingNewPositions))
        return
      }

      // Deltas: the SDK already merged them into the table cache. Here we patch
      // the live store too, so a discovered-but-not-accepting market appears in
      // the strip the moment it starts accepting, and toast that transition.
      const deltas = event.data as MarketDelta[]
      const liveStore = useLiveMarketsStore.getState()
      const wasAccepting = new Map(liveStore.markets.map((m) => [m.id, !!m.acceptingNewPositions]))
      deltas.forEach((d) => liveStore.applyDelta(d))
      const flipped = useLiveMarketsStore
        .getState()
        .markets.filter((m) => m.acceptingNewPositions && wasAccepting.get(m.id) === false)
      notifyAccepting(flipped)
    },
  })
}
