import { create } from 'zustand'
import { extractStack, logError } from '../utils/errorLog'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: 'success' | 'info' | 'warning' | 'error'
  durationMs: number
  createdAt: number
}

// `error` is the raw thrown value (not stored on the toast itself) — passing it
// lets the error log capture the full stack trace alongside the message.
// `context` is extra per-action detail (what was attempted) merged into the log
// entry on top of the live app snapshot.
type AddToastInput = Omit<Toast, 'id' | 'createdAt'> & {
  error?: unknown
  context?: Record<string, unknown>
}

interface ToastState {
  toasts: Toast[]
  add: (toast: AddToastInput) => void
  dismiss: (id: string) => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: ({ error, context, ...toast }) => {
    if (toast.variant === 'error' || toast.variant === 'warning') {
      logError({
        level: toast.variant,
        title: toast.title,
        detail: toast.description,
        stack: extractStack(error),
        context,
        source: 'toast',
      })
    }
    set((state) => ({
      toasts: [
        ...state.toasts,
        { ...toast, id: String(++nextId), createdAt: Date.now() },
      ],
    }))
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))
