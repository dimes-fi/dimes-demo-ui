import { useMemo } from 'react'
import type { Market } from '../api/types'
import { leverageMaxBps, getSidedEligibility } from '../api/types'
import { useLiveMarketsStore } from '../store/liveMarkets'

function formatCategory(c: string) {
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}

export function LiveMarketsStrip({
  category,
  status,
  acceptingNewPositions,
  search,
  visibleIds,
  onSelect,
  onMerge,
}: {
  category?: string
  status?: string
  acceptingNewPositions?: boolean
  search?: string
  visibleIds: Set<string>
  onSelect: (market: Market) => void
  onMerge: () => void
}) {
  const live = useLiveMarketsStore((s) => s.markets)
  const remove = useLiveMarketsStore((s) => s.remove)
  const clear = useLiveMarketsStore((s) => s.clear)

  // Only surface markets that would actually belong in the current view —
  // mirror the table's server-side filters client-side, and never repeat a
  // market that's already rendered in the page below.
  const relevant = useMemo(() => {
    const q = search?.trim().toLowerCase()
    return live.filter((m) => {
      if (visibleIds.has(m.id)) return false
      if (acceptingNewPositions === true && !m.acceptingNewPositions) return false
      if (acceptingNewPositions === false && m.acceptingNewPositions) return false
      if (category && m.category?.toLowerCase() !== category.toLowerCase()) return false
      if (status && m.status !== status) return false
      if (q && !(m.title ?? m.ticker).toLowerCase().includes(q)) return false
      return true
    })
  }, [live, visibleIds, acceptingNewPositions, category, status, search])

  if (relevant.length === 0) return null

  const count = relevant.length
  const merge = () => {
    onMerge()
    clear()
  }

  return (
    <div className="live-strip" role="status" aria-live="polite">
      <style>{`
        @keyframes liveStripIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes liveChipIn {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes liveChipGlow {
          0% { box-shadow: 0 0 0 0 var(--green-border); }
          100% { box-shadow: 0 0 0 6px rgba(68,255,151,0); }
        }
        @keyframes livePulse {
          0% { box-shadow: 0 0 0 0 rgba(68,255,151,0.55); }
          70% { box-shadow: 0 0 0 7px rgba(68,255,151,0); }
          100% { box-shadow: 0 0 0 0 rgba(68,255,151,0); }
        }
        .live-strip {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px 8px 12px;
          margin-bottom: 10px;
          background:
            linear-gradient(90deg, rgba(68,255,151,0.06), rgba(68,255,151,0) 220px),
            var(--card-elevated);
          border: 1px solid var(--border-strong);
          border-left: 2px solid var(--green);
          animation: liveStripIn 0.28s ease-out;
        }
        .live-strip__lead {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          white-space: nowrap;
        }
        .live-strip__dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--green);
          animation: livePulse 1.8s ease-out infinite;
        }
        .live-strip__label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: var(--green);
          text-transform: uppercase;
        }
        .live-strip__count {
          font-size: var(--fs-sm);
          font-weight: 600;
          color: var(--text);
          font-variant-numeric: tabular-nums;
        }
        .live-strip__count span { color: var(--text-muted); font-weight: 500; }
        .live-strip__track {
          display: flex;
          gap: 6px;
          flex: 1;
          min-width: 0;
          overflow-x: auto;
          scrollbar-width: thin;
          padding-bottom: 1px;
        }
        .live-strip__track::-webkit-scrollbar { height: 4px; }
        .live-strip__track::-webkit-scrollbar-thumb { background: var(--border-strong); }
        .live-chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          max-width: 280px;
          padding: 5px 8px;
          background: var(--card);
          border: 1px solid var(--border);
          cursor: pointer;
          animation: liveChipIn 0.3s ease-out backwards, liveChipGlow 1.1s ease-out;
          transition: border-color 0.15s ease, background 0.15s ease;
        }
        .live-chip:hover {
          border-color: var(--green-border);
          background: var(--green-soft);
        }
        .live-chip__title {
          font-size: var(--fs-sm);
          font-weight: 500;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 0;
        }
        .live-chip__cat {
          font-size: 10px;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          flex-shrink: 0;
        }
        .live-chip__pills { display: inline-flex; gap: 3px; flex-shrink: 0; }
        .live-pill {
          font-size: 10px;
          font-weight: 600;
          padding: 1px 5px;
          font-variant-numeric: tabular-nums;
          white-space: nowrap;
        }
        .live-pill--open {
          color: var(--green);
          background: var(--green-soft);
          border: 1px solid var(--green-border);
        }
        .live-pill--closed {
          color: var(--red);
          background: var(--red-soft);
          border: 1px solid var(--red-border);
        }
        .live-chip__x {
          flex-shrink: 0;
          background: none;
          border: none;
          padding: 0 2px;
          cursor: pointer;
          color: var(--text-dim);
          font-size: 13px;
          line-height: 1;
          transition: color 0.15s ease;
        }
        .live-chip__x:hover { color: var(--text); }
        .live-strip__actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .live-strip__merge {
          font-size: var(--fs-xs);
          font-weight: 600;
          padding: 5px 11px;
          background: var(--yellow);
          color: var(--yellow-ink);
          border: 1px solid var(--yellow);
          cursor: pointer;
          white-space: nowrap;
          transition: opacity 0.15s ease;
        }
        .live-strip__merge:hover { opacity: 0.88; }
        .live-strip__dismiss {
          background: none;
          border: 1px solid var(--border-strong);
          color: var(--text-muted);
          padding: 4px 7px;
          cursor: pointer;
          font-size: 13px;
          line-height: 1;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .live-strip__dismiss:hover { color: var(--text); border-color: var(--text-muted); }
      `}</style>

      <div className="live-strip__lead">
        <span className="live-strip__dot" />
        <span className="live-strip__label">Live</span>
        <span className="live-strip__count">
          {count} <span>new {count === 1 ? 'market' : 'markets'}</span>
        </span>
      </div>

      <div className="live-strip__track dimes-scroll">
        {relevant.map((m, i) => (
          <LiveChip
            key={m.id}
            market={m}
            index={i}
            onSelect={() => onSelect(m)}
            onDismiss={() => remove(m.id)}
          />
        ))}
      </div>

      <div className="live-strip__actions">
        <button className="live-strip__merge" onClick={merge}>
          Show in list
        </button>
        <button
          className="live-strip__dismiss"
          onClick={clear}
          title="Dismiss all"
          aria-label="Dismiss all new markets"
        >
          ×
        </button>
      </div>
    </div>
  )
}

function LiveChip({
  market,
  index,
  onSelect,
  onDismiss,
}: {
  market: Market
  index: number
  onSelect: () => void
  onDismiss: () => void
}) {
  const elig = getSidedEligibility(market)
  const yesLev = (leverageMaxBps(market.leverage, 'yes') / 10000).toFixed(1)
  const noLev = (leverageMaxBps(market.leverage, 'no') / 10000).toFixed(1)

  return (
    <div
      className="live-chip"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
      onClick={onSelect}
      title={market.title || market.ticker}
    >
      {market.category && <span className="live-chip__cat">{formatCategory(market.category)}</span>}
      <span className="live-chip__title">{market.title || market.ticker}</span>
      <span className="live-chip__pills">
        <span className={`live-pill ${elig.yes.open ? 'live-pill--open' : 'live-pill--closed'}`}>
          {elig.yes.open ? `Y ${yesLev}×` : 'Y ×'}
        </span>
        <span className={`live-pill ${elig.no.open ? 'live-pill--open' : 'live-pill--closed'}`}>
          {elig.no.open ? `N ${noLev}×` : 'N ×'}
        </span>
      </span>
      <button
        className="live-chip__x"
        onClick={(e) => {
          e.stopPropagation()
          onDismiss()
        }}
        title="Dismiss"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}
