import { useEffect, useRef, useState } from 'react'

/**
 * Smoothly follows a moving `target` with a time-based exponential ease, so the
 * displayed value chases the target instead of jumping. Unlike a fixed-duration
 * tween, retargeting mid-flight (e.g. a fast slider drag) just redirects the
 * chase rather than restarting it, which keeps fast input feeling fluid.
 *
 * `tauMs` is the time constant — smaller is snappier, larger is lazier.
 */
export function useSmoothNumber(target: number, tauMs = 90): number {
  const [value, setValue] = useState(target)
  const valueRef = useRef(target)
  const lastRef = useRef(0)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!Number.isFinite(target)) {
      valueRef.current = target
      // eslint-disable-next-line react-hooks/set-state-in-effect -- settle immediately, no animation
      setValue(target)
      return
    }
    // Settle threshold scales with magnitude so it works for both small and
    // large value ranges (leverage is in basis points: tens of thousands).
    const epsilon = Math.max(0.5, Math.abs(target) * 1e-4)
    if (Math.abs(valueRef.current - target) <= epsilon) {
      valueRef.current = target
      setValue(target)
      return
    }

    lastRef.current = 0
    const tick = (now: number) => {
      const dt = lastRef.current ? now - lastRef.current : 16
      lastRef.current = now
      const alpha = 1 - Math.exp(-dt / tauMs)
      let next = valueRef.current + (target - valueRef.current) * alpha
      if (Math.abs(target - next) <= epsilon) next = target
      valueRef.current = next
      setValue(next)
      if (next !== target) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, tauMs])

  return value
}
