import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query and re-render on match changes. SSR-safe
 * (returns false until mounted) and uses the modern change listener.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  )

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/**
 * True on phone-width viewports. 768px is the app's single mobile breakpoint —
 * below it the layout switches to the single-column, bottom-nav shell. Kept in
 * sync with the `@media (max-width: 768px)` rules in global.css.
 */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 768px)')
}
