import { create } from 'zustand'
import { logError } from '../utils/errorLog'

export interface Toast {
  id: string
  title: string
  description?: string
  variant: 'success' | 'info' | 'warning' | 'error'
  durationMs: number
  createdAt: number
}

interface ToastState {
  toasts: Toast[]
  add: (toast: Omit<Toast, 'id' | 'createdAt'>) => void
  dismiss: (id: string) => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  add: (toast) => {
    if (toast.variant === 'error' || toast.variant === 'warning') {
      logError({
        level: toast.variant,
        title: toast.title,
        detail: toast.description,
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
