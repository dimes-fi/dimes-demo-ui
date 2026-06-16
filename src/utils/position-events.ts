import type { PositionEventType } from '@dimes-dot-fi/sdk'
import type { Toast } from '../store/toasts'

interface ToastConfig {
  title: string
  variant: Toast['variant']
  durationMs: number
}

const eventToastMap: Record<PositionEventType, ToastConfig> = {
  'position.created': { title: 'Position created', variant: 'info', durationMs: 5000 },
  'position.opening': { title: 'Position finalizing', variant: 'info', durationMs: 5000 },
  'position.opened': { title: 'Position opened', variant: 'success', durationMs: 5000 },
  'position.close_requested': { title: 'Close requested', variant: 'info', durationMs: 5000 },
  'position.closed': { title: 'Position closed', variant: 'success', durationMs: 5000 },
  'position.settled': { title: 'Position settled', variant: 'success', durationMs: 5000 },
  'position.liquidated': { title: 'Position liquidated', variant: 'warning', durationMs: 8000 },
  'position.force_unwound': { title: 'Leverage reduced', variant: 'warning', durationMs: 8000 },
  'position.reverted': { title: 'Position failed', variant: 'error', durationMs: 8000 },
  'position.cancelled': { title: 'Position cancelled', variant: 'info', durationMs: 5000 },
}

export function toastForPositionEvent(
  eventType: PositionEventType,
  marketTicker?: string,
): Omit<Toast, 'id' | 'createdAt'> {
  const config = eventToastMap[eventType]
  return {
    ...config,
    description: marketTicker ?? undefined,
  }
}
