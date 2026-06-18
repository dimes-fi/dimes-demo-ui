import { useMemo } from 'react'
import type { Market, FeeRates } from '../api/types'
import {
  computeMaxGain,
  computeOriginationFeeUsdcUnits,
  computePolymarketTradingFee,
  estimateLiquidationPrice,
  expectedPositionTokenUnits,
  resolveOriginationFeeBps,
} from '../api/types'
import { formatUsd } from '../utils/format'
import { StatRow } from './StatRow'

const USDC_UNITS_PER_USD = 1e6

function effectiveEntryPriceUsd(market: Market, side: 'yes' | 'no'): number {
  const prices = market.prices
  if (!prices) return NaN
  return Number(side === 'yes' ? prices.yesAskPriceUsd : prices.noAskPriceUsd)
}

/**
 * Client-side offer estimate shown before the user requests a quote. Uses the
 * SDK math with the fee rates from `useFeeRates`, mirroring the server's offer
 * computation. Approximate — the binding quote (and its TWAP/inference-based
 * liquidation price) is authoritative.
 */
export function TradeEstimate({
  market,
  side,
  collateralUsd,
  leverageBps,
  slippageBps,
  feeRates,
}: {
  market: Market
  side: 'yes' | 'no'
  collateralUsd: number
  leverageBps: number
  slippageBps: number
  feeRates: FeeRates
}) {
  const estimate = useMemo(() => {
    const entryPriceUsd = effectiveEntryPriceUsd(market, side)
    if (!Number.isFinite(entryPriceUsd) || entryPriceUsd <= 0 || collateralUsd <= 0) {
      return null
    }

    const notionalUsd = collateralUsd * (leverageBps / 10000)
    const notionalUsdcUnits = Math.round(notionalUsd * USDC_UNITS_PER_USD)

    const positionTokenUnits = expectedPositionTokenUnits(notionalUsdcUnits, entryPriceUsd, slippageBps)

    const originationFeeBps = resolveOriginationFeeBps(
      feeRates.originationFeeTiers,
      leverageBps,
      feeRates.partnerOriginationFeeBps,
    )
    const originationFeeUsdcUnits = computeOriginationFeeUsdcUnits(notionalUsdcUnits, originationFeeBps)

    const tradingFeeUsdcUnits = feeRates.market
      ? computePolymarketTradingFee({
          notionalUsdcUnits,
          priceUsd: entryPriceUsd,
          feeRateBps: feeRates.market.polymarketTradingFeeBps,
          feeExponent: feeRates.market.polymarketFeeExponent,
          builderTakerFeeRateBps: feeRates.partnerTradingFeeBps,
        })
      : 0

    const liquidationPriceUsd = estimateLiquidationPrice(entryPriceUsd, leverageBps, feeRates.liquidationFeeBps)

    const maxGain = computeMaxGain({
      positionTokenUnits,
      notionalUsdcUnits,
      expectedOpenTradingFeeUsdcUnits: tradingFeeUsdcUnits,
      originationFeeUsdcUnits,
    })

    return {
      entryPriceUsd,
      notionalUsd,
      originationFeeBps,
      originationFeeUsdcUnits,
      tradingFeeUsdcUnits,
      liquidationPriceUsd,
      netMaxGainUsdcUnits: maxGain.netMaxGainUsdcUnits,
    }
  }, [market, side, collateralUsd, leverageBps, slippageBps, feeRates])

  if (!estimate) return null

  const usd = (usdcUnits: number) => formatUsd(usdcUnits / USDC_UNITS_PER_USD)

  return (
    <div style={{ padding: '12px 0' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>Estimate</span>
        <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>Get a quote for exact terms</span>
      </div>

      <StatRow label="Entry Price" value={`$${estimate.entryPriceUsd.toFixed(2)}`} />
      <StatRow label="Position Value" value={formatUsd(estimate.notionalUsd)} />
      <StatRow
        label="Est. Liquidation Price"
        value={`$${estimate.liquidationPriceUsd.toFixed(2)}`}
        valueColor="#F5A623"
      />

      <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

      <StatRow
        label="Est. Origination Fee"
        value={`${(estimate.originationFeeBps / 100).toFixed(2)}% (${usd(estimate.originationFeeUsdcUnits)})`}
      />
      <StatRow
        label={market.provider === 'kalshi' ? 'Est. Kalshi Fee' : 'Est. Polymarket Fee'}
        value={usd(estimate.tradingFeeUsdcUnits)}
      />

      <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

      <StatRow
        label="Est. max gain on win"
        value={usd(estimate.netMaxGainUsdcUnits)}
        valueColor={estimate.netMaxGainUsdcUnits >= 0 ? '#44FF97' : '#F5A623'}
      />
    </div>
  )
}
