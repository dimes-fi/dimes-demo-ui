import { useEffect, useRef, useState } from 'react'

/**
 * Returns a nonce that increments whenever `value` changes, used to re-trigger
 * a one-shot CSS flash on the changed element (key the element on the nonce to
 * remount it). The initial mount does NOT flash — only subsequent changes do.
 * Unlike `useValueTween` (which ramps the number), this only signals "it just
 * changed."
 */
export function useFlashOnChange(value: unknown): number {
  const [nonce, setNonce] = useState(0)
  const prev = useRef(value)

  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value
      setNonce((n) => n + 1)
    }
  }, [value])

  return nonce
}
