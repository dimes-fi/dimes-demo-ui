import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MarketSocket } from '@dimes-dot-fi/sdk/ws'
import type { MarketDelta, MarketEvent } from '@dimes-dot-fi/sdk/ws'
import type { Market } from '../api/types'
import type { MarketsPage } from './useMarkets'
import { useAuthStore } from '../store/auth'
import { useLiveMarketsStore } from '../store/liveMarkets'

const API_BASE = import.meta.env.VITE_API_URL || 'https://api-sandbox.dimes.fi'

function mergeDelta(page: MarketsPage, delta: MarketDelta): MarketsPage {
  const idx = page.data.findIndex((m) => m.id === delta.id)
  if (idx < 0) {
    return page
  }
  const data = [...page.data]
  data[idx] = { ...data[idx], ...delta } as Market
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
        useLiveMarketsStore.getState().add(event.data as Market[])
        return
      }
      // Deltas (eligibility / max-leverage changes). Patch BOTH:
      //  - the queued live market, so a discovered-but-not-accepting market
      //    becomes visible in the strip the moment it starts accepting;
      //  - the table cache, so rows already displayed update in place
      //    (mergeDelta is a no-op for ids not present in the page).
      const deltas = event.data as MarketDelta[]
      const liveStore = useLiveMarketsStore.getState()
      deltas.forEach((d) => liveStore.applyDelta(d))
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
