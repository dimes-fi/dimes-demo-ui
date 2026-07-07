import { useRef, useState, useCallback, useEffect } from 'react'
import type { PositionPartialCloseList } from '../api/types'

interface ChartPoint {
  date: Date
  tokenUnits: number
  isCloseEvent: boolean
  soldTokenUnits?: number
  averageSalePriceUsd?: string
  userPayoutUsd?: string
}

function toTokens(units: string | number): number {
  return Number(units) / 1_000_000
}

function buildChartPoints(
  closes: PositionPartialCloseList,
  originalTokenUnits: string | null | undefined,
  currentTokenUnits: string,
  openedAt: string | undefined,
  endAt?: Date,
): { points: ChartPoint[]; hasTimeline: boolean } {
  const points: ChartPoint[] = []
  const terminalDate = endAt ?? new Date()
  const hasTimeline = !!openedAt

  if (openedAt && originalTokenUnits != null) {
    points.push({
      date: new Date(openedAt),
      tokenUnits: toTokens(originalTokenUnits),
      isCloseEvent: false,
    })
  } else if (originalTokenUnits != null) {
    // No open timestamp — synthesize a flat lead-in at the original size.
    points.push({
      date: new Date(terminalDate.getTime() - 60 * 60 * 1000),
      tokenUnits: toTokens(originalTokenUnits),
      isCloseEvent: false,
    })
  }

  for (const close of closes.data) {
    points.push({
      date: new Date(close.executedAt),
      tokenUnits: toTokens(close.remainingPositionTokenUnits),
      isCloseEvent: true,
      soldTokenUnits: toTokens(close.soldTokenUnits),
      averageSalePriceUsd: close.averageSalePriceUsd,
      userPayoutUsd: close.userPayoutUsd,
    })
  }

  // Extend a flat line to "now" at the live survivor size.
  const lastPoint = points[points.length - 1]
  const currentTokens = toTokens(currentTokenUnits)
  if (currentTokens > 0 && (!lastPoint || lastPoint.date < terminalDate)) {
    points.push({ date: terminalDate, tokenUnits: currentTokens, isCloseEvent: false })
  }

  return { points, hasTimeline }
}

function formatAxisLabel(d: Date, spanMs: number): string {
  // Short-lived positions (opened and closed within a day) read as clock times;
  // longer histories read as dates.
  if (spanMs < 24 * 60 * 60 * 1000) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatTooltipDate(d: Date): string {
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatTokens(tokens: number): string {
  return tokens.toLocaleString('en-US', { maximumFractionDigits: tokens < 10 ? 2 : 0 })
}

interface TooltipState {
  clientX: number
  clientY: number
  index: number
}

const PAD_LEFT = 40
const PAD_RIGHT = 12
const PAD_TOP = 10
const PAD_BOTTOM = 24
const HEIGHT = 130

export function PartialCloseChart({
  partialCloses,
  originalTokenUnits,
  currentTokenUnits,
  openedAt,
  isLoading,
  endAt,
}: {
  partialCloses: PositionPartialCloseList | undefined
  originalTokenUnits: string | null | undefined
  currentTokenUnits: string
  openedAt: string | undefined
  isLoading: boolean
  endAt?: Date
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [svgWidth, setSvgWidth] = useState(300)

  const measureRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setSvgWidth(w)
    })
    ro.observe(node)
    setSvgWidth(node.getBoundingClientRect().width || 300)
  }, [])

  useEffect(() => {
    if (!tooltip) return
    const dismiss = () => setTooltip(null)
    window.addEventListener('scroll', dismiss, true)
    return () => window.removeEventListener('scroll', dismiss, true)
  }, [tooltip])

  if (isLoading) {
    return (
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 0,
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Size History
        </div>
        <div
          style={{
            height: HEIGHT,
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 0,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
        <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
      </div>
    )
  }

  // Nothing to show unless at least one partial close happened.
  if (!partialCloses || partialCloses.data.length === 0) return null

  const { points, hasTimeline } = buildChartPoints(
    partialCloses,
    originalTokenUnits,
    currentTokenUnits,
    openedAt,
    endAt,
  )
  if (points.length < 2) return null

  const chartW = svgWidth - PAD_LEFT - PAD_RIGHT
  const chartH = HEIGHT - PAD_TOP - PAD_BOTTOM

  const spanMs = points[points.length - 1].date.getTime() - points[0].date.getTime()

  // Discrete close events are spaced evenly on the x-axis (ordinal), not by real
  // time. A position can be opened and partially closed minutes apart, which on a
  // time axis jams the events together and collides the labels.
  const stepCount = points.length - 1

  const maxSize = Math.max(...points.map((p) => p.tokenUnits))
  const yMax = maxSize * 1.15 || 1
  const yMin = 0
  const yRange = yMax - yMin || 1

  const toX = (i: number) => PAD_LEFT + (stepCount === 0 ? chartW / 2 : (i / stepCount) * chartW)
  const toY = (tokens: number) => PAD_TOP + (1 - (tokens - yMin) / yRange) * chartH

  // Step path (post-step: hold flat, then drop vertically at each close).
  let linePath = `M ${toX(0).toFixed(1)} ${toY(points[0].tokenUnits).toFixed(1)}`
  for (let i = 1; i < points.length; i++) {
    const x = toX(i).toFixed(1)
    const y = toY(points[i].tokenUnits).toFixed(1)
    const prevY = toY(points[i - 1].tokenUnits).toFixed(1)
    linePath += ` L ${x} ${prevY} L ${x} ${y}`
  }

  const lastX = toX(points.length - 1).toFixed(1)
  const bottomY = (PAD_TOP + chartH).toFixed(1)
  const firstX = toX(0).toFixed(1)
  const areaPath = `${linePath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`

  // Y ticks: 0 + each distinct size level, thinned so labels don't overlap.
  const MIN_LABEL_PX = 14
  const candidates = [yMin, ...points.map((p) => p.tokenUnits)].filter((v) => v >= yMin && v <= yMax)
  const uniqueGridLevels: number[] = []
  for (const v of candidates) {
    const vy = PAD_TOP + (1 - (v - yMin) / yRange) * chartH
    if (
      uniqueGridLevels.every(
        (u) => Math.abs(PAD_TOP + (1 - (u - yMin) / yRange) * chartH - vy) >= MIN_LABEL_PX,
      )
    ) {
      uniqueGridLevels.push(v)
    }
  }

  const xTickSet = new Set<number>([0, points.length - 1])
  if (points.length > 3) xTickSet.add(Math.floor(points.length / 2))
  const xTicks = [...xTickSet].sort((a, b) => a - b)

  const handleMouseMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = e.clientX - rect.left
    let closestIdx = 0
    let minDist = Infinity
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(toX(i) - mouseX)
      if (d < minDist) {
        minDist = d
        closestIdx = i
      }
    }
    setTooltip({ clientX: e.clientX, clientY: e.clientY, index: closestIdx })
  }

  const hoverPoint = tooltip ? points[tooltip.index] : null

  return (
    <>
      <div
        style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 0,
          padding: '12px 14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--text)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
            }}
          >
            Size History
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
            {partialCloses.data.length} partial close{partialCloses.data.length === 1 ? '' : 's'}
          </div>
        </div>

        <div ref={measureRef} style={{ width: '100%' }}>
          <svg ref={svgRef} width={svgWidth} height={HEIGHT} style={{ display: 'block', overflow: 'visible' }}>
            <defs>
              <linearGradient id="sizeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5B9CF5" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#5B9CF5" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Y-axis title */}
            <text
              transform={`translate(10 ${PAD_TOP + chartH / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize={9}
              fontFamily="var(--font)"
              fill="var(--text-dim)"
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
            >
              tokens held
            </text>

            {/* Gridlines + Y labels */}
            {uniqueGridLevels.map((lev) => {
              const gy = toY(lev)
              return (
                <g key={lev}>
                  <line
                    x1={PAD_LEFT}
                    y1={gy}
                    x2={PAD_LEFT + chartW}
                    y2={gy}
                    stroke="rgba(255,255,255,0.05)"
                    strokeWidth={1}
                  />
                  <text
                    x={PAD_LEFT - 4}
                    y={gy + 4}
                    textAnchor="end"
                    fontSize={10}
                    fontFamily="var(--font)"
                    fill="var(--text-dim)"
                  >
                    {formatTokens(lev)}
                  </text>
                </g>
              )
            })}

            {/* Area fill */}
            <path d={areaPath} fill="url(#sizeAreaGrad)" />

            {/* Step line */}
            <path d={linePath} fill="none" stroke="#5B9CF5" strokeWidth={1.5} strokeLinejoin="miter" />

            {/* Close event dots */}
            {points.map((p, i) =>
              p.isCloseEvent ? (
                <circle
                  key={i}
                  cx={toX(i)}
                  cy={toY(p.tokenUnits)}
                  r={3}
                  fill="#5B9CF5"
                  stroke="rgba(12,12,12,0.8)"
                  strokeWidth={1}
                />
              ) : null,
            )}

            {/* Origin dot */}
            <circle cx={toX(0)} cy={toY(points[0].tokenUnits)} r={2.5} fill="rgba(255,255,255,0.45)" />

            {/* X-axis labels */}
            {hasTimeline &&
              xTicks.map((idx, i) => {
                const tx = toX(idx)
                const anchor = i === 0 ? 'start' : i === xTicks.length - 1 ? 'end' : 'middle'
                return (
                  <text
                    key={idx}
                    x={tx}
                    y={PAD_TOP + chartH + 16}
                    textAnchor={anchor}
                    fontSize={10}
                    fontFamily="var(--font)"
                    fill="var(--text-dim)"
                  >
                    {formatAxisLabel(points[idx].date, spanMs)}
                  </text>
                )
              })}

            {/* Hover crosshair */}
            {hoverPoint &&
              (() => {
                const hx = toX(tooltip!.index)
                const hy = toY(hoverPoint.tokenUnits)
                return (
                  <>
                    <line
                      x1={hx}
                      y1={PAD_TOP}
                      x2={hx}
                      y2={PAD_TOP + chartH}
                      stroke="rgba(255,255,255,0.2)"
                      strokeWidth={1}
                      strokeDasharray="3 3"
                      pointerEvents="none"
                    />
                    <circle
                      cx={hx}
                      cy={hy}
                      r={4}
                      fill="#5B9CF5"
                      stroke="rgba(12,12,12,0.9)"
                      strokeWidth={1.5}
                      pointerEvents="none"
                    />
                  </>
                )
              })()}

            {/* Invisible interaction layer */}
            <rect
              x={PAD_LEFT}
              y={PAD_TOP}
              width={chartW}
              height={chartH}
              fill="transparent"
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'crosshair' }}
            />
          </svg>
        </div>
      </div>

      {/* Tooltip — fixed position follows mouse */}
      {tooltip && hoverPoint && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.clientX + 12,
            top: tooltip.clientY - 40,
            background: 'rgba(20,20,20,0.96)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 0,
            padding: '5px 9px',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 1000,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', fontFamily: 'var(--font)' }}>
            {formatTokens(hoverPoint.tokenUnits)} tok held
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-muted)',
              marginTop: 1,
              fontFamily: 'var(--font)',
            }}
          >
            {formatTooltipDate(hoverPoint.date)}
            {hoverPoint.isCloseEvent && (
              <span style={{ color: 'var(--text-dim)', marginLeft: 4 }}>· partial close</span>
            )}
          </div>
          {hoverPoint.isCloseEvent && (
            <div
              style={{
                marginTop: 5,
                paddingTop: 5,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                fontSize: 10,
                lineHeight: 1.5,
                color: '#9CC2F7',
                fontFamily: 'var(--font)',
              }}
            >
              <div>
                Sold {formatTokens(hoverPoint.soldTokenUnits ?? 0)} tok @ ${hoverPoint.averageSalePriceUsd}
              </div>
              <div>Payout ${hoverPoint.userPayoutUsd}</div>
            </div>
          )}
        </div>
      )}
    </>
  )
}
