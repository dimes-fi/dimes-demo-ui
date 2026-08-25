import { useCallback, useId, useState } from 'react'

const ADAPTIVE_COLOR = '#F5A623'
const COMMITTED_COLOR = '#5B9CF5'
const EXAMPLE_COLOR = '#8A8F98'
const AXIS_COLOR = 'rgba(255,255,255,0.10)'
const TRACK_COLOR = 'rgba(255,255,255,0.06)'

const PAD_TOP = 22
const PAD_BOTTOM = 14
const LANE_GAP = 16
const ROW_HEIGHT = 20
const MIN_PLOT_HEIGHT = 120
const MAX_PLOT_HEIGHT = 260
const PRICE_LABEL_WIDTH = 34
const LEVERAGE_LABEL_WIDTH = 36
const BAR_HEIGHT = 6
const MIN_LABEL_SPACING = 12
const DOMAIN_FLOOR_FRACTION = 0.985
const ONE_X_BPS = 10000
const HEADING_Y = PAD_TOP - 6

export interface CommittedStep {
  triggerPriceUsd: string
  targetLeverageBps: number
}

export interface CommittedPlan {
  steps: CommittedStep[]
}

interface Mark {
  priceUsd: number
  leverageBps: number
  label: string
  isFired: boolean
}

function formatCents(usd: number): string {
  const tenths = Math.round(usd * 1000 + 1e-6)
  return `${(tenths / 10).toFixed(1).replace(/\.0$/, '')}¢`
}

function formatLeverage(bps: number): string {
  return `${(bps / ONE_X_BPS).toFixed(2).replace(/\.00$/, '')}x`
}

function useMeasuredWidth(initial: number) {
  const [width, setWidth] = useState(initial)
  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width
      if (measured) setWidth(measured)
    })
    observer.observe(node)
    setWidth(node.getBoundingClientRect().width || initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial is a constant default
  }, [])
  return { width, measureRef }
}

function buildCommittedMarks(plan: CommittedPlan, firedPricesUsd: string[]): Mark[] {
  const fired = new Set(firedPricesUsd.map((price) => Number(price)))

  return plan.steps
    .map((step) => ({
      priceUsd: Number(step.triggerPriceUsd),
      leverageBps: step.targetLeverageBps,
      label: formatCents(Number(step.triggerPriceUsd)),
      isFired: fired.has(Number(step.triggerPriceUsd)),
    }))
    .sort((a, b) => b.priceUsd - a.priceUsd)
}

export function RiskModeRail({
  entryPriceUsd,
  entryLeverageBps,
  adaptiveLiquidationPriceUsd,
  currentPriceUsd = null,
  committed,
  selected,
  view = 'quote',
  firedTriggerPricesUsd = [],
  example = 'none',
  showEntryLabel = true,
}: {
  entryPriceUsd: string
  entryLeverageBps: number
  adaptiveLiquidationPriceUsd: string
  /** Where the market trades right now, drawn as a dotted line across the rail. Omit to hide it. */
  currentPriceUsd?: string | null
  committed: CommittedPlan | null
  selected?: 'adaptive' | 'committed'
  view?: 'quote' | 'position'
  firedTriggerPricesUsd?: string[]
  /**
   * Which lanes are drawn from illustrative numbers rather than a real quote. Example lanes are flat
   * grey, carry no price or leverage labels, and hold still, so their shape can be read but their
   * figures can never be mistaken for the user's terms.
   */
  example?: 'none' | 'committed' | 'all'
  /** Set false when the caller prints the entry price and leverage itself, above the rail. */
  showEntryLabel?: boolean
}) {
  const { width, measureRef } = useMeasuredWidth(360)
  const idPrefix = useId().replace(/:/g, '')

  const entryPrice = Number(entryPriceUsd)
  const adaptiveLiquidation = Number(adaptiveLiquidationPriceUsd)
  const committedMarks = committed ? buildCommittedMarks(committed, firedTriggerPricesUsd) : []

  const isAdaptiveExample = example === 'all'
  const isCommittedExample = example !== 'none'
  const currentPrice =
    currentPriceUsd != null && !isAdaptiveExample && Number.isFinite(Number(currentPriceUsd))
      ? Number(currentPriceUsd)
      : null

  const lowestMark = Math.min(
    adaptiveLiquidation,
    ...committedMarks.map((mark) => mark.priceUsd),
    currentPrice ?? Infinity,
  )
  const domainMax = Math.max(entryPrice, currentPrice ?? -Infinity)
  const domainMin = lowestMark * DOMAIN_FLOOR_FRACTION

  const plotHeight = Math.min(
    MAX_PLOT_HEIGHT,
    Math.max(MIN_PLOT_HEIGHT, (committedMarks.length + 1) * ROW_HEIGHT),
  )
  const height = plotHeight + PAD_TOP + PAD_BOTTOM
  const toY = (price: number): number =>
    PAD_TOP + ((domainMax - price) / (domainMax - domainMin)) * plotHeight

  const isSingleLane = view === 'position'
  const showAdaptiveLane = !isSingleLane || selected !== 'committed'
  const showCommittedLane = committed != null && (!isSingleLane || selected === 'committed')

  const laneCount = (showAdaptiveLane ? 1 : 0) + (showCommittedLane ? 1 : 0)
  const laneWidth = laneCount === 2 ? (width - LANE_GAP) / 2 : width
  const committedX = showAdaptiveLane ? laneWidth + LANE_GAP : 0

  const adaptiveOpacity = !isAdaptiveExample && laneCount === 2 && selected === 'committed' ? 0.35 : 1
  const committedOpacity = !isCommittedExample && laneCount === 2 && selected === 'adaptive' ? 0.35 : 1

  return (
    <div ref={measureRef} style={{ width: '100%' }}>
      <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
        <line
          x1={0}
          y1={toY(entryPrice)}
          x2={width}
          y2={toY(entryPrice)}
          stroke={AXIS_COLOR}
          strokeWidth={1}
        />
        {!isAdaptiveExample && showEntryLabel && (
          <text
            x={width}
            y={toY(entryPrice) - 6}
            textAnchor="end"
            fontSize={10}
            fontFamily="var(--font)"
            fill="var(--text-dim)"
          >
            entry {formatCents(entryPrice)} · {formatLeverage(entryLeverageBps)}
          </text>
        )}

        {currentPrice != null && (
          <g>
            <line
              x1={0}
              y1={toY(currentPrice)}
              x2={width}
              y2={toY(currentPrice)}
              stroke="var(--text-dim)"
              strokeWidth={1}
              strokeDasharray="2 3"
              opacity={0.55}
            />
            <text
              x={width}
              y={toY(currentPrice) + 10}
              textAnchor="end"
              fontSize={9}
              fontFamily="var(--font)"
              fill="var(--text-dim)"
              stroke="var(--card, #141414)"
              strokeWidth={3}
              paintOrder="stroke"
            >
              now {formatCents(currentPrice)}
            </text>
          </g>
        )}

        {showAdaptiveLane && (
          <AdaptiveLane
            idPrefix={idPrefix}
            laneWidth={laneWidth}
            headingY={HEADING_Y}
            entryY={toY(entryPrice)}
            liquidationY={toY(adaptiveLiquidation)}
            liquidationLabel={formatCents(adaptiveLiquidation)}
            bottomY={PAD_TOP + plotHeight}
            opacity={adaptiveOpacity}
            isExample={isAdaptiveExample}
          />
        )}

        {showCommittedLane && committed && (
          <CommittedLane
            x={committedX}
            laneWidth={laneWidth}
            headingY={HEADING_Y}
            entryY={toY(entryPrice)}
            entryLeverageBps={entryLeverageBps}
            marks={committedMarks}
            toY={toY}
            opacity={committedOpacity}
            isExample={isCommittedExample}
          />
        )}
      </svg>
    </div>
  )
}

function LeverageBar({
  x,
  y,
  trackWidth,
  leverageBps,
  entryLeverageBps,
  color,
  filled,
}: {
  x: number
  y: number
  trackWidth: number
  leverageBps: number
  entryLeverageBps: number
  color: string
  filled: boolean
}) {
  const span = Math.max(1, entryLeverageBps - ONE_X_BPS)
  const fraction = Math.max(0, Math.min(1, (leverageBps - ONE_X_BPS) / span))

  return (
    <>
      <rect x={x} y={y - BAR_HEIGHT / 2} width={trackWidth} height={BAR_HEIGHT} fill={TRACK_COLOR} />
      <rect
        x={x}
        y={y - BAR_HEIGHT / 2}
        width={Math.max(1.5, trackWidth * fraction)}
        height={BAR_HEIGHT}
        fill={color}
        opacity={filled ? 1 : 0.5}
      />
    </>
  )
}

function AdaptiveLane({
  idPrefix,
  laneWidth,
  headingY,
  entryY,
  liquidationY,
  liquidationLabel,
  bottomY,
  opacity,
  isExample,
}: {
  idPrefix: string
  laneWidth: number
  headingY: number
  entryY: number
  liquidationY: number
  liquidationLabel: string
  bottomY: number
  opacity: number
  isExample: boolean
}) {
  const hatchId = `${idPrefix}-hatch`
  const fadeId = `${idPrefix}-fade`
  const maskId = `${idPrefix}-mask`
  const blurId = `${idPrefix}-blur`
  const driftClass = `${idPrefix}-drift`

  const trackX = PRICE_LABEL_WIDTH
  const trackWidth = Math.max(20, laneWidth - PRICE_LABEL_WIDTH - LEVERAGE_LABEL_WIDTH)
  const bandX = 0
  const bandWidth = laneWidth
  const bandHeight = Math.max(0, bottomY - entryY)
  const ghostY = liquidationY + (bottomY - liquidationY) * 0.55
  const laneColor = isExample ? EXAMPLE_COLOR : ADAPTIVE_COLOR

  return (
    <g opacity={opacity}>
      <defs>
        <pattern id={hatchId} width={5} height={5} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <line x1={0} y1={0} x2={0} y2={5} stroke={laneColor} strokeWidth={1} opacity={0.3} />
        </pattern>
        <linearGradient id={fadeId} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" stopColor="#fff" stopOpacity={0.95} />
          <stop offset="45%" stopColor="#fff" stopOpacity={0.5} />
          <stop offset="100%" stopColor="#fff" stopOpacity={0} />
        </linearGradient>
        <mask id={maskId}>
          <rect x={bandX} y={entryY} width={bandWidth} height={bandHeight} fill={`url(#${fadeId})`} />
        </mask>
        <filter id={blurId} x="-20%" y="-400%" width="140%" height="900%">
          <feGaussianBlur stdDeviation={2.4} />
        </filter>
      </defs>
      <style>{`
        .${driftClass} { animation: ${driftClass}-move 7s ease-in-out infinite; }
        @keyframes ${driftClass}-move {
          0%, 100% { transform: translateY(-3px); }
          50% { transform: translateY(5px); }
        }
        @media (prefers-reduced-motion: reduce) { .${driftClass} { animation: none; } }
      `}</style>

      <text x={0} y={headingY} fontSize={9} fontFamily="var(--font)" fill={laneColor} letterSpacing="0.1em">
        ADAPTIVE
      </text>

      <g mask={`url(#${maskId})`}>
        <rect x={bandX} y={entryY} width={bandWidth} height={bandHeight} fill={`url(#${hatchId})`} />
        <g className={isExample ? undefined : driftClass} filter={`url(#${blurId})`}>
          <rect x={trackX} y={ghostY - 1.5} width={trackWidth} height={3} fill={laneColor} opacity={0.85} />
        </g>
      </g>

      <text
        x={bandX + bandWidth / 2}
        y={entryY + (liquidationY - entryY) / 2}
        textAnchor="middle"
        fontSize={9}
        fontWeight={500}
        fontFamily="var(--font)"
        fill={laneColor}
        stroke="var(--card, #141414)"
        strokeWidth={3}
        paintOrder="stroke"
      >
        dynamic unwinding
      </text>

      {!isExample && (
        <text
          x={0}
          y={liquidationY + 3.5}
          fontSize={11}
          fontFamily="var(--font)"
          fill="var(--text)"
          fontWeight={600}
          stroke="var(--card, #141414)"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {liquidationLabel}
        </text>
      )}
      <rect x={trackX} y={liquidationY - 1.5} width={trackWidth} height={3} fill={laneColor} />
      <text
        x={trackX + trackWidth + 6}
        y={liquidationY + 3.5}
        fontSize={10}
        fontFamily="var(--font)"
        fill="var(--text-dim)"
        stroke="var(--card, #141414)"
        strokeWidth={3}
        paintOrder="stroke"
      >
        liq
      </text>
    </g>
  )
}

function CommittedLane({
  x,
  laneWidth,
  headingY,
  entryY,
  entryLeverageBps,
  marks,
  toY,
  opacity,
  isExample,
}: {
  x: number
  laneWidth: number
  headingY: number
  entryY: number
  entryLeverageBps: number
  marks: Mark[]
  toY: (price: number) => number
  opacity: number
  isExample: boolean
}) {
  const trackX = x + PRICE_LABEL_WIDTH
  const trackWidth = Math.max(20, laneWidth - PRICE_LABEL_WIDTH - LEVERAGE_LABEL_WIDTH)
  const laneColor = isExample ? EXAMPLE_COLOR : COMMITTED_COLOR
  const spineBottomY = marks.length
    ? Math.max(...marks.map((mark) => toY(mark.priceUsd)))
    : entryY

  const labelVisibility: boolean[] = []
  let lastLabelY = -Infinity
  marks.forEach((mark, index) => {
    const y = toY(mark.priceUsd)
    const isEdge = index === 0 || index === marks.length - 1
    const visible = !isExample && (isEdge || y - lastLabelY >= MIN_LABEL_SPACING)
    if (visible) lastLabelY = y
    labelVisibility.push(visible)
  })

  return (
    <g opacity={opacity}>
      <text
        x={x}
        y={headingY}
        fontSize={9}
        fontFamily="var(--font)"
        fill={laneColor}
        letterSpacing="0.1em"
      >
        COMMITTED
      </text>

      <rect
        x={trackX}
        y={entryY}
        width={trackWidth}
        height={Math.max(0, spineBottomY + BAR_HEIGHT / 2 - entryY)}
        fill={TRACK_COLOR}
        opacity={0.4}
      />
      <line
        x1={trackX + trackWidth / 2}
        y1={entryY}
        x2={trackX + trackWidth / 2}
        y2={spineBottomY}
        stroke={laneColor}
        strokeWidth={1}
        strokeDasharray="1 3"
        opacity={0.35}
      />

      {marks.map((mark, index) => {
        const y = toY(mark.priceUsd)
        const showLabel = labelVisibility[index]

        return (
          <g key={`${mark.label}-${index}`}>
            {showLabel && (
              <text
                x={x}
                y={y + 3.5}
                fontSize={10}
                fontFamily="var(--font)"
                fill="var(--text-muted)"
              >
                {mark.label}
              </text>
            )}
            <LeverageBar
              x={trackX}
              y={y}
              trackWidth={trackWidth}
              leverageBps={mark.leverageBps}
              entryLeverageBps={entryLeverageBps}
              color={laneColor}
              filled={mark.isFired}
            />
            {showLabel && (
              <text
                x={trackX + trackWidth + 6}
                y={y + 3.5}
                fontSize={10}
                fontFamily="var(--font)"
                fill="var(--text)"
              >
                {formatLeverage(mark.leverageBps)}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}
