import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PositionSocket } from '@dimes-dot-fi/sdk/ws'
import type { NotificationEvent, PositionEvent } from '@dimes-dot-fi/sdk/ws'
import type { Position } from '../api/types'
import { useAuthStore } from '../store/auth'
import { usePendingPositionsStore } from '../store/pendingPositions'
import { usePartialOpenStore } from '../store/partialOpen'
import { useToastStore } from '../store/toasts'
import { toastForPositionEvent } from '../utils/position-events'
import { fillProgressLabel } from '../utils/partialFill'
import { getApiBase } from '../runtimeConfig'

export const wsTimestamps = new Map<string, number>()

const API_BASE = getApiBase()

export function usePositionSocket() {
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const queryClient = useQueryClient()
  const socketRef = useRef<PositionSocket | null>(null)
  const addToast = useToastStore((s) => s.add)
  const removePending = usePendingPositionsStore((s) => s.remove)
  const setPartialProgress = usePartialOpenStore((s) => s.setProgress)
  const setFloorMissed = usePartialOpenStore((s) => s.setFloorMissed)

  const handleNotification = useCallback(
    (event: NotificationEvent) => {
      const { code, message, params } = event.data
      const positionId = typeof params?.positionId === 'string' ? params.positionId : null

      // Partial-open progress drives the live fill bar on the position card and
      // a transient toast — bps shown as a %, attempt number only when > 1.
      if (code === 'PARTIAL_OPEN_PROGRESS' && positionId) {
        const filledBps = typeof params?.filledBps === 'number' ? params.filledBps : 0
        const attemptNumber = typeof params?.attemptNumber === 'number' ? params.attemptNumber : 0
        setPartialProgress(positionId, {
          filledBps,
          attemptNumber,
          cumulativeFilledMakingAmount:
            typeof params?.cumulativeFilledMakingAmount === 'string'
              ? params.cumulativeFilledMakingAmount
              : undefined,
          targetMakingAmount:
            typeof params?.targetMakingAmount === 'string' ? params.targetMakingAmount : undefined,
        })
        addToast({
          title: 'Order filling',
          description: fillProgressLabel(filledBps, attemptNumber),
          variant: 'info',
          durationMs: 4000,
        })
        return
      }

      // Terminal failure: floor never filled, the position was reverted and the
      // user fully refunded. Surface it loudly.
      if (code === 'PARTIAL_OPEN_FLOOR_MISSED') {
        if (positionId) setFloorMissed(positionId)
        addToast({
          title: 'Order did not fill',
          description: 'Minimum fill not reached — your funds were refunded.',
          variant: 'error',
          durationMs: 8000,
        })
        return
      }

      addToast({
        title: message,
        variant: 'info',
        durationMs: 5000,
      })
    },
    [addToast, setPartialProgress, setFloorMissed],
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
