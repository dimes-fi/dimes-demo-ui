import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PositionSocket } from '@dimes-dot-fi/sdk/ws'
import type { NotificationEvent, PositionEvent } from '@dimes-dot-fi/sdk/ws'
import type { Position } from '../api/types'
import { useAuthStore } from '../store/auth'
import { usePendingPositionsStore } from '../store/pendingPositions'
import { useToastStore } from '../store/toasts'
import { toastForPositionEvent } from '../utils/position-events'
import { getApiBase } from '../runtimeConfig'

export const wsTimestamps = new Map<string, number>()

const API_BASE = getApiBase()

export function usePositionSocket() {
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const queryClient = useQueryClient()
  const socketRef = useRef<PositionSocket | null>(null)
  const addToast = useToastStore((s) => s.add)
  const removePending = usePendingPositionsStore((s) => s.remove)

  const handleNotification = useCallback(
    (event: NotificationEvent) => {
      addToast({
        title: event.data.message,
        variant: 'info',
        durationMs: 5000,
      })
    },
    [addToast],
  )

  const handleEvent = useCallback(
    (event: PositionEvent) => {
      const position = event.data as Position
      const positionId = position.id

      queryClient.setQueriesData<Position[]>(
        { queryKey: ['positions'] },
        (old) => {
          if (!old) return old
          const idx = old.findIndex((p) => p.id === positionId)
          if (idx >= 0) {
            const updated = [...old]
            updated[idx] = position
            return updated
          }
          if (event.type === 'position.created') {
            return [position, ...old]
          }
          return old
        },
      )

      wsTimestamps.set(positionId, Date.now())

      if (
        event.type === 'position.created' ||
        event.type === 'position.opening' ||
        event.type === 'position.opened'
      ) {
        removePending(position.onChainPositionKey)
      }

      const ticker = position.marketTitle ?? position.marketTicker
      addToast(toastForPositionEvent(event.type, ticker))
    },
    [queryClient, addToast, removePending],
  )

  useEffect(() => {
    if (!walletAddress) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = new PositionSocket({
      baseUrl: API_BASE,
      getToken: () => useAuthStore.getState().jwt,
    })

    const unsubEvent = socket.on('*', handleEvent)
    const unsubNotification = socket.onNotification(handleNotification)

    let isFirstConnect = true
    const unsubReconnect = socket.onConnect(() => {
      if (isFirstConnect) {
        isFirstConnect = false
        return
      }
      queryClient.invalidateQueries({ queryKey: ['positions'] })
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
      unsubNotification()
      unsubReconnect()
      socket.disconnect()
      socketRef.current = null
    }
  }, [walletAddress, handleEvent, handleNotification, queryClient])
}
