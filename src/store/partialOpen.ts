import { create } from 'zustand'

// Live progress of a partial open, driven by the two websocket notifications:
//   PARTIAL_OPEN_PROGRESS     — after each fill (floor + each retry)
//   PARTIAL_OPEN_FLOOR_MISSED — terminal: floor never filled, position refunded
//
// Keyed by positionId. The position itself already exists in cache by the time
// these fire (they happen during open finalization), so cards can look up their
// own progress directly.

export interface PartialOpenProgress {
  filledBps: number
  attemptNumber: number
  cumulativeFilledMakingAmount?: string
  targetMakingAmount?: string
  floorMissed: boolean
  updatedAt: number
}

interface PartialOpenState {
  byPosition: Record<string, PartialOpenProgress>
  setProgress: (
    positionId: string,
    data: {
      filledBps: number
      attemptNumber: number
      cumulativeFilledMakingAmount?: string
      targetMakingAmount?: string
    },
  ) => void
  setFloorMissed: (positionId: string) => void
  clear: (positionId: string) => void
}

export const usePartialOpenStore = create<PartialOpenState>((set) => ({
  byPosition: {},
  setProgress: (positionId, data) =>
    set((state) => ({
      byPosition: {
        ...state.byPosition,
        [positionId]: {
          ...state.byPosition[positionId],
          ...data,
          floorMissed: false,
          updatedAt: Date.now(),
        },
      },
    })),
  setFloorMissed: (positionId) =>
    set((state) => {
      const existing = state.byPosition[positionId]
      return {
        byPosition: {
          ...state.byPosition,
          [positionId]: {
            filledBps: existing?.filledBps ?? 0,
            attemptNumber: existing?.attemptNumber ?? 0,
            cumulativeFilledMakingAmount: existing?.cumulativeFilledMakingAmount,
            targetMakingAmount: existing?.targetMakingAmount,
            floorMissed: true,
            updatedAt: Date.now(),
          },
        },
      }
    }),
  clear: (positionId) =>
    set((state) => {
      if (!(positionId in state.byPosition)) return state
      const next = { ...state.byPosition }
      delete next[positionId]
      return { byPosition: next }
    }),
}))
