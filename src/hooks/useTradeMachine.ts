import { useCallback, useMemo } from 'react';
import { useQuoteMachine, type QuoteMachineState } from '@dimes-dot-fi/sdk/react';
import { buildQuoteParams } from '@dimes-dot-fi/sdk';
import type { CreateOfferParams, Offer } from '@dimes-dot-fi/sdk';

// ---------------------------------------------------------------------------
// The interactive draft → review → promote → (market-moved accept) machine now
// lives in the SDK as `useQuoteMachine`. This hook is a thin adapter that keeps
// the demo's existing call shape: it maps the panel's param object onto the
// SDK's `QuoteParams` and renames `promotedQuote` back to `promotedOffer` for
// the components that still read that field.
// ---------------------------------------------------------------------------

export interface UseTradeMachineParams {
  marketTicker: string;
  effectiveSide: 'yes' | 'no';
  leverageBps: number;
  collateralUsd: number;
  slippageBps: number;
  allowPartialFill?: boolean;
  minFillBps?: number;
}

export type OfferParamsWithPartial = CreateOfferParams & {
  allowPartialFill?: boolean;
  minFillBps?: number;
};

// `buildQuoteParams` is now partial-fill aware (it threads allowPartialFill /
// minFillBps straight through `QuoteParams`), so this is just a compatibility
// shim for the one caller that still composes params in two steps.
export function withPartialFill(
  params: CreateOfferParams,
  opts: { allowPartialFill?: boolean; minFillBps?: number },
): OfferParamsWithPartial {
  if (!opts.allowPartialFill) return params;
  return {
    ...params,
    allowPartialFill: true,
    ...(opts.minFillBps != null ? { minFillBps: opts.minFillBps } : {}),
  };
}

export { buildQuoteParams };

export type TradeState =
  | { phase: 'idle' }
  | { phase: 'loading-draft' }
  | { phase: 'draft-ready'; draft: Offer; quotedAt: number }
  | { phase: 'promoting'; draft: Offer; quotedAt: number }
  | { phase: 'promoted'; draft: Offer; promotedOffer: Offer; correctedFrom?: Offer; quotedAt: number }
  | { phase: 'market-moved'; originalDraft: Offer; newDraft: Offer; retryCount: number; quotedAt: number }
  | { phase: 'error'; error: unknown; draft?: Offer };

function adaptState(state: QuoteMachineState): TradeState {
  if (state.phase === 'promoted') {
    const { promotedQuote, ...rest } = state;
    return { ...rest, promotedOffer: promotedQuote };
  }
  return state;
}

export function useTradeMachine() {
  const { state, getDraft: sdkGetDraft, promote, correctAndPromote, acceptChanges, reset } = useQuoteMachine();

  const getDraft = useCallback(
    (params: UseTradeMachineParams) =>
      sdkGetDraft({
        marketTicker: params.marketTicker,
        side: params.effectiveSide,
        collateralUsd: params.collateralUsd,
        leverageBps: params.leverageBps,
        slippageBps: params.slippageBps,
        allowPartialFill: params.allowPartialFill,
        minFillBps: params.minFillBps,
      }),
    [sdkGetDraft],
  );

  const adapted = useMemo(() => adaptState(state), [state]);

  return { state: adapted, getDraft, promote, correctAndPromote, acceptChanges, reset };
}
