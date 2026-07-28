import type { PositionEventType } from '@dimes-dot-fi/sdk'
import type { PositionTiming } from '../api/types'
import type { Toast } from '../store/toasts'

interface ToastConfig {
  title: string
  variant: Toast['variant']
  durationMs: number
}

export type SettlementState = PositionTiming['settlementState']

const eventToastMap: Record<PositionEventType, ToastConfig> = {
  'position.created': { title: 'Position created', variant: 'info', durationMs: 5000 },
  'position.opening': { title: 'Position finalizing', variant: 'info', durationMs: 5000 },
  'position.opened': { title: 'Position opened', variant: 'success', durationMs: 5000 },
  'position.close_requested': { title: 'Close requested', variant: 'info', durationMs: 5000 },
  'position.closed': { title: 'Position closed', variant: 'success', durationMs: 5000 },
  'position.settled': { title: 'Position settled', variant: 'success', durationMs: 5000 },
  'position.liquidated': { title: 'Position liquidated', variant: 'warning', durationMs: 8000 },
  'position.force_unwound': { title: 'Leverage reduced', variant: 'warning', durationMs: 8000 },
  'position.partial_close_requested': { title: 'Reduce requested', variant: 'info', durationMs: 5000 },
  'position.partial_close_initiated': { title: 'Reducing position', variant: 'info', durationMs: 5000 },
  'position.partial_closed': { title: 'Position reduced', variant: 'success', durationMs: 5000 },
  'position.partial_close_aborted': { title: 'Reduction cancelled', variant: 'info', durationMs: 5000 },
  'position.reverted': { title: 'Position failed', variant: 'error', durationMs: 8000 },
  'position.cancelled': { title: 'Position cancelled', variant: 'info', durationMs: 5000 },
  // Overridden per settlement state below — this is the fallback wording.
  'position.settlement_state_changed': {
    title: 'Settlement update',
    variant: 'info',
    durationMs: 6000,
  },
}

/**
 * How the market this position sits on is progressing towards paying out. Only
 * `none` means "nothing pending"; the rest are stages the position passes
 * through once its market stops trading.
 */
const settlementStateToast: Record<SettlementState, ToastConfig & { detail: string }> = {
  none: {
    title: 'Market trading again',
    detail: 'Nothing pending — the market is back to normal trading.',
    variant: 'info',
    durationMs: 5000,
  },
  awaiting_resolution: {
    title: 'Awaiting the result',
    detail: 'The market closed. Waiting for the official outcome to be published.',
    variant: 'info',
    durationMs: 8000,
  },
  settling: {
    title: 'Settling',
    detail: 'The result is in — your position is being settled.',
    variant: 'info',
    durationMs: 8000,
  },
  voided: {
    title: 'Market voided',
    detail: 'The market was voided. Every share pays out at $0.50.',
    variant: 'warning',
    durationMs: 10000,
  },
  unresolved_upstream: {
    title: 'Result may never come',
    detail: 'The market disappeared before a result was published. Resolution is uncertain.',
    variant: 'warning',
    durationMs: 10000,
  },
}

/** Short label for the same states, for inline display next to a position. */
export const settlementStateLabel: Record<SettlementState, string> = {
  none: '',
  awaiting_resolution: 'awaiting result',
  settling: 'settling',
  voided: 'voided',
  unresolved_upstream: 'unresolved',
}

export function toastForPositionEvent(
  eventType: PositionEventType,
  marketTicker?: string,
  settlementState?: SettlementState,
): Omit<Toast, 'id' | 'createdAt'> {
  if (eventType === 'position.settlement_state_changed' && settlementState) {
    const { title, detail, variant, durationMs } = settlementStateToast[settlementState]
    return {
      title,
      description: marketTicker ? `${marketTicker} — ${detail}` : detail,
      variant,
      durationMs,
    }
  }

  const config = eventToastMap[eventType]
  return {
    ...config,
    description: marketTicker ?? undefined,
  }
}
