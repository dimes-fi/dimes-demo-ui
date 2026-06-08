import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { MarketSocket } from '@dimes-dot-fi/sdk/ws'
import type { MarketDelta, MarketEvent } from '@dimes-dot-fi/sdk/ws'
import type { Market } from '../api/types'
import type { MarketsPage } from './useMarkets'
import { useAuthStore } from '../store/auth'

const API_BASE = import.meta.env.VITE_API_URL || 'https://api-sandbox.dimes.fi'

function upsertMarket(page: MarketsPage, market: Market): MarketsPage {
  const idx = page.data.findIndex((m) => m.id === market.id)
  if (idx >= 0) {
    const data = [...page.data]
    data[idx] = market
    return { ...page, data }
  }
  return { ...page, data: [market, ...page.data] }
}

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
      queryClient.setQueriesData<MarketsPage>({ queryKey: ['markets'] }, (old) => {
        if (!old) return old
        if (event.type === 'market.discovered') {
          return (event.data as Market[]).reduce(upsertMarket, old)
        }
        return (event.data as MarketDelta[]).reduce(mergeDelta, old)
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
