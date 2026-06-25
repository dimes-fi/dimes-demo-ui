import { usePositionStream } from '@dimes-dot-fi/sdk/react'
import type { NotificationEvent, PositionEvent } from '@dimes-dot-fi/sdk/ws'
import type { Position } from '../api/types'
import { useAuthStore } from '../store/auth'
import { usePendingPositionsStore } from '../store/pendingPositions'
import { usePartialOpenStore } from '../store/partialOpen'
import { useToastStore } from '../store/toasts'
import { toastForPositionEvent } from '../utils/position-events'
import { fillProgressLabel } from '../utils/partialFill'

/**
 * Live position updates. The SDK's `usePositionStream` (reconcile mode) owns the
 * socket lifecycle, reconnect-on-token, pause-on-hidden, and merging events into
 * the `usePositions` cache. This hook only contributes the demo-specific side
 * effects — pending-stub cleanup, toasts, and the partial-open progress store —
 * through the callbacks.
 */
export function usePositionSocket() {
  const walletAddress = useAuthStore((s) => s.walletAddress)
  const addToast = useToastStore((s) => s.add)
  const removePending = usePendingPositionsStore((s) => s.remove)
  const setPartialProgress = usePartialOpenStore((s) => s.setProgress)
  const setFloorMissed = usePartialOpenStore((s) => s.setFloorMissed)

  usePositionStream({
    enabled: !!walletAddress,
    mode: 'reconcile',
    onEvent: (event: PositionEvent) => {
      const position = event.data as Position
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
    onNotification: (event: NotificationEvent) => {
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
  })
}
