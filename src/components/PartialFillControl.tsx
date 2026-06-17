import {
  MIN_FILL_BPS_MIN,
  MIN_FILL_BPS_MAX,
  MIN_FILL_BPS_STEP,
} from '../utils/partialFill'

// Opt-in for partial fills on open. A switch reveals a 20%–50% slider (5% steps)
// for `minFillBps`. Range + step are guaranteed here, so the server only ever
// rejects on the notional floor-cap (handled inline by the trade panel).
export function PartialFillControl({
  enabled,
  minFillBps,
  notionalUsd,
  onToggle,
  onChangeMinFill,
}: {
  enabled: boolean
  minFillBps: number
  notionalUsd: number
  onToggle: (next: boolean) => void
  onChangeMinFill: (bps: number) => void
}) {
  const minPct = MIN_FILL_BPS_MIN / 100
  const maxPct = MIN_FILL_BPS_MAX / 100
  const pct = minFillBps / 100
  const range = MIN_FILL_BPS_MAX - MIN_FILL_BPS_MIN
  const fillPct = range > 0 ? ((minFillBps - MIN_FILL_BPS_MIN) / range) * 100 : 0
  const steps: number[] = []
  for (let b = MIN_FILL_BPS_MIN; b <= MIN_FILL_BPS_MAX; b += MIN_FILL_BPS_STEP) steps.push(b)

  // Worst-case opened size if the order fills right at the floor.
  const floorNotional = notionalUsd > 0 ? (notionalUsd * minFillBps) / 10000 : null

  return (
    <div className="pf">
      <div className="pf__head">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className={`pf__switch${enabled ? ' pf__switch--on' : ''}`}
          onClick={() => onToggle(!enabled)}
        >
          <span className="pf__switch-knob" />
        </button>
        <div className="pf__head-text">
          <span className="pf__title">Allow partial fill</span>
          <span className="pf__sub">
            Open at the filled size instead of all-or-nothing
          </span>
        </div>
      </div>

      <div className={`pf__panel${enabled ? ' pf__panel--open' : ''}`}>
        <div className="pf__panel-inner">
          <div className="pf__slider-head">
            <span className="pf__slider-label">Minimum fill</span>
            <span className="pf__value">{pct}%</span>
          </div>

          <div className="pf__track-host">
            <div className="pf__track" />
            <div className="pf__track-fill" style={{ width: `${fillPct}%` }} />
            {steps.map((b) => {
              const dotPct = range > 0 ? ((b - MIN_FILL_BPS_MIN) / range) * 100 : 50
              return (
                <span
                  key={b}
                  className="pf__dot"
                  style={{
                    left: `${dotPct}%`,
                    background:
                      b <= minFillBps
                        ? 'rgba(238,255,0,0.7)'
                        : 'rgba(255,255,255,0.15)',
                  }}
                />
              )
            })}
            <span className="pf__thumb" style={{ left: `${fillPct}%` }} />
            <input
              type="range"
              min={MIN_FILL_BPS_MIN}
              max={MIN_FILL_BPS_MAX}
              step={MIN_FILL_BPS_STEP}
              value={minFillBps}
              onChange={(e) => onChangeMinFill(Number(e.target.value))}
              className="pf__range"
              aria-label="Minimum fill percent"
            />
          </div>

          <div className="pf__scale">
            <span>{minPct}%</span>
            <span>{maxPct}%</span>
          </div>

          <p className="pf__note">
            {floorNotional != null ? (
              <>
                Fills at least <strong>{pct}%</strong> — as little as{' '}
                <strong>${floorNotional.toFixed(2)}</strong> of your requested
                size. Anything below this is refunded.
              </>
            ) : (
              <>Fills at least {pct}% of your requested size, or is refunded.</>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
