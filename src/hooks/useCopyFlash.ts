import { useRef, useState } from 'react'

/** How long the green "copied" flash lingers before fading back. */
export const COPY_FLASH_MS = 500

/**
 * Copy a value to the clipboard and briefly flag it as copied so the UI can
 * flash green. Keyed so a component with several copyable fields (e.g. a title
 * and an ID) tracks which one was last copied. Shared by every card, drawer and
 * panel that has copy-to-clipboard affordances.
 */
export function useCopyFlash() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = (value: string, key = 'default') => {
    void navigator.clipboard.writeText(value)
    setCopiedKey(key)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopiedKey(null), COPY_FLASH_MS)
  }

  const isCopied = (key = 'default') => copiedKey === key

  return { copiedKey, isCopied, copy }
}
