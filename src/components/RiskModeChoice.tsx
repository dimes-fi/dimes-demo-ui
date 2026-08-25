import { useId } from 'react'
import type { RiskMode } from '@dimes-dot-fi/sdk'
import { RiskModeRail, type CommittedPlan } from './RiskModeRail'

const USDC_UNITS_PER_USD = 1e6

const ADAPTIVE_COLOR = '#F5A623'
const COMMITTED_COLOR = '#5B9CF5'

const exampleCommittedPlan: CommittedPlan = {
  steps: [
    { triggerPriceUsd: '0.4400', targetLeverageBps: 22500 },
    { triggerPriceUsd: '0.3800', targetLeverageBps: 16000 },
    { triggerPriceUsd: '0.3300', targetLeverageBps: 12000 },
  ],
}

const exampleEntryPriceUsd = '0.5000'
const exampleEntryLeverageBps = 30000
const exampleAdaptiveLiquidationPriceUsd = '0.3400'

function formatEntrySummary(entryPriceUsd: string, entryLeverageBps: number): string {
  const cents = (Math.round(Number(entryPriceUsd) * 1000 + 1e-6) / 10).toFixed(1).replace(/\.0$/, '')
  const leverage = (entryLeverageBps / 10000).toFixed(2).replace(/\.00$/, '')
  return `entry ${cents}¢ · ${leverage}x`
}

function formatUsd(usdcUnits: string): string {
  return `$${(Number(usdcUnits) / USDC_UNITS_PER_USD).toFixed(2)}`
}

export function RiskModeChoice({
  value,
  marginUsdcUnits,
  isCommittedOffered,
  unavailableMessage,
  entryPriceUsd,
  entryLeverageBps,
  adaptiveLiquidationPriceUsd,
  currentPriceUsd = null,
  committedPlan,
  onChange,
}: {
  value: RiskMode
  marginUsdcUnits: string | null
  /**
   * Whether the quote offers committed mode. It omits `committedUnwinds` entirely when the mode is
   * switched off for the environment, and sets `available: false` when this particular quote cannot
   * take it. Either way the card stays visible but disabled, over an example ladder.
   */
  isCommittedOffered: boolean
  /** The API's explanation for an unavailable committed card, printed inside it. */
  unavailableMessage?: string
  entryPriceUsd: string
  entryLeverageBps: number
  adaptiveLiquidationPriceUsd: string
  /** Where the market trades right now, marked on both rails. Omit when no live price is known. */
  currentPriceUsd?: string | null
  committedPlan: CommittedPlan | null
  onChange: (next: RiskMode) => void
}) {
  const groupName = useId()
  const reasonId = `${groupName}-committed-reason`

  const depositLabel =
    marginUsdcUnits === null
      ? 'Refundable deposit'
      : `+ ${formatUsd(marginUsdcUnits)} refundable deposit`
  const hasCommittedPlan = isCommittedOffered && committedPlan != null

  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 6,
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>How you get unwound</span>
        <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>
          {formatEntrySummary(entryPriceUsd, entryLeverageBps)}
        </span>
      </div>

      {/* The two cards share one grid so their titles, subtitles and rails sit on the same lines
          however the deposit title wraps — a flex row let the longer title push its card's rail down. */}
      <div
        role="radiogroup"
        aria-label="Risk mode"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: 'auto auto 1fr',
          gap: 8,
          alignItems: 'stretch',
        }}
      >
      <ModeCard
        groupName={groupName}
        mode="adaptive"
        color={ADAPTIVE_COLOR}
        title="No deposit"
        subtitle="engine-managed"
        isSelected={value === 'adaptive'}
        isDisabled={false}
        onSelect={onChange}
      >
        <RiskModeRail
          entryPriceUsd={entryPriceUsd}
          entryLeverageBps={entryLeverageBps}
          adaptiveLiquidationPriceUsd={adaptiveLiquidationPriceUsd}
          currentPriceUsd={currentPriceUsd}
          committed={null}
          selected="adaptive"
          view="position"
          showEntryLabel={false}
        />
      </ModeCard>

      <ModeCard
        groupName={groupName}
        mode="committed"
        color={COMMITTED_COLOR}
        title={depositLabel}
        subtitle="fixed ladder"
        isSelected={value === 'committed'}
        isDisabled={!isCommittedOffered}
        describedById={isCommittedOffered ? undefined : reasonId}
        onSelect={onChange}
      >
        {hasCommittedPlan ? (
          <RiskModeRail
            entryPriceUsd={entryPriceUsd}
            entryLeverageBps={entryLeverageBps}
            adaptiveLiquidationPriceUsd={adaptiveLiquidationPriceUsd}
            currentPriceUsd={currentPriceUsd}
            committed={committedPlan}
            selected="committed"
            view="position"
            showEntryLabel={false}
          />
        ) : (
          <RiskModeRail
            entryPriceUsd={exampleEntryPriceUsd}
            entryLeverageBps={exampleEntryLeverageBps}
            adaptiveLiquidationPriceUsd={exampleAdaptiveLiquidationPriceUsd}
            committed={exampleCommittedPlan}
            selected="committed"
            view="position"
            example="all"
          />
        )}

        {!isCommittedOffered && (
          <p
            id={reasonId}
            style={{ margin: '8px 0 0', fontSize: 10, lineHeight: 1.45, color: 'var(--text-dim)' }}
          >
            {unavailableMessage ?? "Committed isn't available for this quote."}
          </p>
        )}
      </ModeCard>
      </div>
    </div>
  )
}

function ModeCard({
  groupName,
  mode,
  color,
  title,
  subtitle,
  isSelected,
  isDisabled,
  describedById,
  onSelect,
  children,
}: {
  groupName: string
  mode: RiskMode
  color: string
  title: string
  subtitle: string
  isSelected: boolean
  isDisabled: boolean
  describedById?: string
  onSelect: (next: RiskMode) => void
  children: React.ReactNode
}) {
  return (
    <label
      className="risk-mode-card"
      style={{
        minWidth: 0,
        display: 'grid',
        gridRow: 'span 3',
        gridTemplateRows: 'subgrid',
        rowGap: 0,
        padding: '10px 10px 12px',
        border: `1px solid ${isSelected ? color : 'rgba(255,255,255,0.12)'}`,
        background: isSelected ? `${color}14` : 'transparent',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
      }}
    >
      <input
        type="radio"
        name={groupName}
        value={mode}
        checked={isSelected}
        disabled={isDisabled}
        aria-describedby={describedById}
        onChange={() => onSelect(mode)}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />

      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'var(--font)',
          lineHeight: 1.25,
          color: isSelected ? 'var(--text)' : 'var(--text-muted)',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 11, lineHeight: 1.25, color: 'var(--text-dim)', marginTop: 2 }}>
        {subtitle}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8, minWidth: 0 }}>
        {children}
      </div>
    </label>
  )
}
