import { create } from 'zustand'
import type { Market } from '../api/types'

// Newly-discovered markets — both streamed over the websocket and seeded via a
// REST prefetch sorted by discovered_at_desc — held OUTSIDE the paginated
// ['markets'] query cache so they never pollute the server-sorted,
// server-filtered table. The LiveMarketsStrip reads from here and applies the
// table's active filters at render time.
const MAX_LIVE = 50

/** `discoveredAt` (ISO 8601, always set) — when Bloom first listed the market. */
export function marketDiscoveredAtMs(m: Market): number {
  const t = Date.parse(m.discoveredAt)
  return Number.isNaN(t) ? 0 : t
}

// A delta carries `id` plus a partial market patch — see MarketDelta in the SDK.
type Patch = { id: string } & Partial<Market>

interface LiveMarketsState {
  markets: Market[] // ordered newest-discovered first; INCLUDES not-yet-accepting markets
  add: (incoming: Market[]) => void
  applyDelta: (patch: Patch) => void
  remove: (id: string) => void
  clear: () => void
}

export const useLiveMarketsStore = create<LiveMarketsState>((set) => ({
  markets: [],
  add: (incoming) =>
    set((state) => {
      if (incoming.length === 0) return state
      const incomingIds = new Set(incoming.map((m) => m.id))
      const merged = [...incoming, ...state.markets.filter((m) => !incomingIds.has(m.id))]
      merged.sort((a, b) => marketDiscoveredAtMs(b) - marketDiscoveredAtMs(a))
      return { markets: merged.slice(0, MAX_LIVE) }
    }),
  // Patch a market we already hold (e.g. a discovered-but-not-accepting market
  // whose eligibility flips to accepting seconds/minutes later). No-op if we
  // never saw the discovery — there'd be nothing to render a full chip from.
  applyDelta: (patch) =>
    set((state) => {
      const idx = state.markets.findIndex((m) => m.id === patch.id)
      if (idx < 0) return state
      const markets = [...state.markets]
      // Deep-merge `leverage`: a max-leverage delta carries only the changed
      // leverage fields, so a plain spread drops minBps/stepBps → NaN slider.
      markets[idx] = {
        ...markets[idx],
        ...patch,
        leverage: patch.leverage
          ? { ...markets[idx].leverage, ...patch.leverage }
          : markets[idx].leverage,
      } as Market
      return { markets }
    }),
  remove: (id) =>
    set((state) => ({ markets: state.markets.filter((m) => m.id !== id) })),
  clear: () => set({ markets: [] }),
}))
