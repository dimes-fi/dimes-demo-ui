import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MarketSocket } from '@dimes-dot-fi/sdk/ws'
import type { MarketDelta, MarketEvent } from '@dimes-dot-fi/sdk/ws'
import type { Market } from '../api/types'
import type { MarketsPage } from './useMarkets'
import { useAuthStore } from '../store/auth'
import { useLiveMarketsStore } from '../store/liveMarkets'
import { useToastStore } from '../store/toasts'
import { getApiBase } from '../runtimeConfig'

const API_BASE = getApiBase()

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

// Shallow-spread the delta, but DEEP-merge the nested `leverage` object. A
// max-leverage delta carries only the changed leverage fields, so a plain
// spread replaces the whole object and drops minBps/stepBps → NaN in the
// slider until the next full refetch.
function mergeMarket(prev: Market, delta: MarketDelta): Market {
  return {
    ...prev,
    ...delta,
    leverage: delta.leverage ? { ...prev.leverage, ...delta.leverage } : prev.leverage,
  } as Market
}

function mergeDelta(page: MarketsPage, delta: MarketDelta): MarketsPage {
  const idx = page.data.findIndex((m) => m.id === delta.id)
  if (idx < 0) {
    return page
  }
  const data = [...page.data]
  data[idx] = mergeMarket(data[idx], delta)
  return { ...page, data }
}

export function useMarketSocket() {
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const queryClient = useQueryClient()
  const socketRef = useRef<MarketSocket | null>(null)

  const handleEvent = useCallback(
    (event: MarketEvent) => {
      // Newly-discovered markets do NOT belong in the paginated, server-sorted,
      // server-filtered list cache — injecting them there pollutes filtered
      // views with markets the REST query never returned. Route them to the
      // live-additions store instead; the strip applies active filters itself.
      if (event.type === 'market.discovered') {
        // Queue every discovery — even ones not yet accepting quotes. The strip
        // renders only the accepting ones, so a market stays hidden here until a
        // later eligibility delta flips it (see applyDelta below).
        const discovered = event.data as Market[]
        useLiveMarketsStore.getState().add(discovered)
        // Toast only the discoveries that arrive ALREADY accepting offers —
        // most discoveries are not yet accepting, so toasting every one is
        // far too noisy. The rest are caught on their accepting-flip delta.
        notifyAccepting(discovered.filter((m) => m.acceptingNewPositions))
        return
      }
      // Deltas (eligibility / max-leverage changes). Patch BOTH:
      //  - the queued live market, so a discovered-but-not-accepting market
      //    becomes visible in the strip the moment it starts accepting;
      //  - the table cache, so rows already displayed update in place
      //    (mergeDelta is a no-op for ids not present in the page).
      const deltas = event.data as MarketDelta[]
      const liveStore = useLiveMarketsStore.getState()
      // Snapshot accepting-state before patching so we can detect the
      // not-accepting → accepting transition (the only thing worth a toast).
      const wasAccepting = new Map(
        liveStore.markets.map((m) => [m.id, !!m.acceptingNewPositions]),
      )
      deltas.forEach((d) => liveStore.applyDelta(d))
      const flipped = useLiveMarketsStore
        .getState()
        .markets.filter((m) => m.acceptingNewPositions && wasAccepting.get(m.id) === false)
      notifyAccepting(flipped)
      queryClient.setQueriesData<MarketsPage>({ queryKey: ['markets'] }, (old) => {
        if (!old) return old
        return deltas.reduce(mergeDelta, old)
      })
    },
    [queryClient],
  )

  useEffect(() => {
    if (!walletAddress) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = new MarketSocket({
      baseUrl: API_BASE,
      getToken: () => useAuthStore.getState().jwt,
    })

    const unsubEvent = socket.on('*', handleEvent)

    let isFirstConnect = true
    const unsubReconnect = socket.onConnect(() => {
      if (isFirstConnect) {
        isFirstConnect = false
        return
      }
      queryClient.invalidateQueries({ queryKey: ['markets'] })
    })

    const handleVisibility = () => {
      if (document.hidden) {
        socket.disconnect()
      } else {
        socket.connect()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    socket.connect()
    socketRef.current = socket

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      unsubEvent()
      unsubReconnect()
      socket.disconnect()
      socketRef.current = null
    }
  }, [walletAddress, handleEvent, queryClient])
}
