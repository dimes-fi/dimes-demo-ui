// Re-export all types from the SDK
export type {
  Market,
  MarketLeverage,
  MarketFees,
  MarketPrices,
  MarketSidedEligibility,
  MarketMaxLeveragePerNotional,
  MarketSidedMaxLeveragePerNotional,
  OriginationTier,
  Offer,
  OpenPosition,
  ClosedPosition,
  Position,
  PositionEntry,
  PositionCurrent,
  PositionRisk,
  PositionOpenFees,
  PositionClosedFees,
  PositionResult,
  PositionTiming,
  PositionFailure,
  PositionPartialClose,
  PositionPartialCloseList,
  ContractInfo,
  CreateOfferParams,
  SideEligibility,
  SidedEligibility,
  OriginationFeeBreakdown,
  MaxGainInput,
  MaxGainResult,
  FeeRates,
  FeeRatesMarket,
  FeeRatesOriginationTier,
  GetFeeRatesParams,
} from '@dimes-dot-fi/sdk';

export {
  isOpenPosition,
  isClosedPosition,
  leverageMaxBps,
  getSidedEligibility,
  defaultSide,
  isFullyOpen,
  isFullyClosed,
  rejectionReasonText,
  rejectionReasonShort,
  maxLeverageBpsAtNotional,
  maxViableLeverageBpsForCollateral,
  getOriginationFeeBreakdown,
  computeMaxGain,
  resolveOriginationFeeBps,
  computeOriginationFeeUsdcUnits,
  computePolymarketTradingFee,
  expectedPositionTokenUnits,
  estimateLiquidationPrice,
} from '@dimes-dot-fi/sdk';

import type {
  PositionUnwind as SdkPositionUnwind,
  PositionUnwindList as SdkPositionUnwindList,
} from '@dimes-dot-fi/sdk';

export type UnwindReason =
  | 'activity_surge'
  | 'cancel_acceleration'
  | 'crypto_move'
  | 'depth_decay'
  | 'depth_drain'
  | 'depth_entry_drain'
  | 'game_start'
  | 'large_holder'
  | 'last_trade_divergence'
  | 'lead_change'
  | 'post_hard_exit_losing'
  | 'position_exposure'
  | 'price_drop_full_exit'
  | 'price_drop_moderate'
  | 'price_drop_severe'
  | 'price_drop_warning'
  | 'spread_blowout'
  | 'spread_spike'
  | 'spread_warning'
  | 'stale_refresh'
  | 'unknown';

export type PositionUnwind = SdkPositionUnwind & {
  reason?: UnwindReason | null;
  reasonDetail?: string | null;
};

export type PositionUnwindList = Omit<SdkPositionUnwindList, 'data'> & { data: PositionUnwind[] };
