import { clampCloseTokenUnits, closeTokenUnitsForPct, pctBpsForCloseTokenUnits } from '@dimes-dot-fi/sdk'
import { useSmoothNumber } from '../hooks/useSmoothNumber'
import { formatUsd } from '../utils/format'

function formatTokens(units: bigint): string {
  return (Number(units) / 1_000_000).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPctBps(bps: number): string {
  return (bps / 100).toFixed(0)
}

export function PartialCloseSlider({
  currentTokenUnits,
  minTokenUnits,
  maxTokenUnits,
  positionValueUsdPips,
  value,
  onChange,
}: {
  currentTokenUnits: bigint
  minTokenUnits: bigint
  maxTokenUnits: bigint
  positionValueUsdPips: string
  value: bigint
  onChange: (closeTokenUnits: bigint) => void
}) {
  const minPctBps = pctBpsForCloseTokenUnits(currentTokenUnits, minTokenUnits)
  const maxPctBps = pctBpsForCloseTokenUnits(currentTokenUnits, maxTokenUnits)
  const valuePctBps = pctBpsForCloseTokenUnits(currentTokenUnits, value)

  const snap = (pctBps: number): bigint => {
    const raw = closeTokenUnitsForPct(currentTokenUnits, pctBps)
    return clampCloseTokenUnits(raw, minTokenUnits, maxTokenUnits)
  }

  const range = maxPctBps - minPctBps
  const smooth = useSmoothNumber(valuePctBps)
  const fillPct = range > 0 ? ((valuePctBps - minPctBps) / range) * 100 : 0

  const usdValue = (Number(positionValueUsdPips) / 10_000) * (valuePctBps / 10_000)

  return (
    <div>
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 14,
        }}
      >
        <span style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600 }}>Amount to close</span>
        <span
          style={{
            color: 'var(--yellow)',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font)',
            textShadow:
              '0 0 20px rgba(238,255,0,0.55), 0 0 50px rgba(238,255,0,0.35), 0 0 80px rgba(238,255,0,0.18)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatPctBps(smooth)}%
        </span>
      </div>

      {/* Track container */}
      <div style={{ position: 'relative', height: 24 }}>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: 2,
            transform: 'translateY(-50%)',
            background: 'rgba(255,255,255,0.08)',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 0,
            width: `${fillPct}%`,
            height: 2,
            transform: 'translateY(-50%)',
            background: 'linear-gradient(90deg, transparent, #EEFF00)',
            transition: 'width 0.1s ease',
          }}
        />

        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${fillPct}%`,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'var(--yellow)',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 8px rgba(238,255,0,0.7)',
            zIndex: 2,
            transition: 'left 0.1s ease',
          }}
        />

        <input
          type="range"
          min={minPctBps}
          max={maxPctBps}
          step={100}
          value={valuePctBps}
          onChange={(e) => onChange(snap(Number(e.target.value)))}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            opacity: 0,
            cursor: 'pointer',
            zIndex: 3,
            margin: 0,
          }}
        />
      </div>

      {/* Sub-row: resolved token + USD amount */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
        }}
      >
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
          {formatTokens(value)} tokens
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
          ≈ {formatUsd(usdValue)}
        </span>
      </div>

      {/* Min/Max labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
          min {formatTokens(minTokenUnits)}
        </span>
        <span style={{ color: 'var(--text-dim)', fontSize: 10 }}>
          max {formatTokens(maxTokenUnits)}
        </span>
      </div>
    </div>
  )
}
