export type MobileTab = 'markets' | 'positions'

/**
 * Fixed bottom tab bar for the mobile shell. Two sections mirror the connected
 * desktop layout (markets list + your positions); the active tab is marked by
 * a glowing yellow rail (see .bottom-nav in global.css). Hidden on desktop via
 * CSS. Positions carries a count badge so open trades are visible without
 * leaving the markets tab.
 */
export function BottomNav({
  active,
  onChange,
  positionCount,
}: {
  active: MobileTab
  onChange: (tab: MobileTab) => void
  positionCount?: number
}) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      <button
        type="button"
        className={`bottom-nav__item${active === 'markets' ? ' bottom-nav__item--active' : ''}`}
        aria-current={active === 'markets' ? 'page' : undefined}
        onClick={() => onChange('markets')}
      >
        <MarketsIcon />
        Markets
      </button>
      <button
        type="button"
        className={`bottom-nav__item${active === 'positions' ? ' bottom-nav__item--active' : ''}`}
        aria-current={active === 'positions' ? 'page' : undefined}
        onClick={() => onChange('positions')}
      >
        <PositionsIcon />
        Positions
        {positionCount != null && positionCount > 0 && (
          <span className="bottom-nav__badge" aria-hidden>
            {positionCount > 99 ? '99+' : positionCount}
          </span>
        )}
      </button>
    </nav>
  )
}

function MarketsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 3v18h18" />
      <path d="M7 15l3-4 3 2 4-6" />
    </svg>
  )
}

function PositionsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="0" />
      <path d="M3 9h18M8 13h8M8 16h5" />
    </svg>
  )
}
