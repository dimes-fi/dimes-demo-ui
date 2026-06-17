// Partial-open (FAK) helpers shared across the trade flow.
//
// Backend mechanics (floor FOK + FAK retries) are invisible to the UI — we only
// touch two request fields (`allowPartialFill`, `minFillBps`), the offer echo,
// and two websocket notification codes. See the backend contract in
// CreateOfferArgs (`min_fill_bps` rules) for the source of these bounds.

/** Minimum acceptable `minFillBps` — 20%. */
export const MIN_FILL_BPS_MIN = 2000
/** Maximum acceptable `minFillBps` — 50%. */
export const MIN_FILL_BPS_MAX = 5000
/** `minFillBps` must be a multiple of this (5% steps). */
export const MIN_FILL_BPS_STEP = 500
/** Default minimum fill when the user first opts in — conservative 50%. */
export const MIN_FILL_BPS_DEFAULT = 5000

/** Snap an arbitrary bps value into the valid [min, max] range on 5% steps. */
export function snapMinFillBps(bps: number): number {
  const clamped = Math.min(Math.max(bps, MIN_FILL_BPS_MIN), MIN_FILL_BPS_MAX)
  const steps = Math.round((clamped - MIN_FILL_BPS_MIN) / MIN_FILL_BPS_STEP)
  return MIN_FILL_BPS_MIN + steps * MIN_FILL_BPS_STEP
}

/** Render bps as a whole-percent label, e.g. 5000 → "50%". */
export function formatFillPct(bps: number): string {
  return `${Math.round(bps / 100)}%`
}

/**
 * Human label for an order-fill websocket notification: bps as a percentage,
 * and the attempt number only when there's been more than one attempt.
 */
export function fillProgressLabel(filledBps: number, attemptNumber: number): string {
  const pct = formatFillPct(filledBps)
  return attemptNumber > 1 ? `${pct} filled · attempt ${attemptNumber}` : `${pct} filled`
}

/**
 * Rejection codes specific to partial-open. Range/step are pre-validated by the
 * slider, so in practice only the floor-cap and kill-switch codes surface — but
 * we map all of them so a stale/edge request still reads cleanly.
 */
export const PARTIAL_FILL_ERROR_MESSAGES: Record<string, string> = {
  QUOTE_MIN_FILL_BPS_REQUIRES_FAK:
    'Partial-fill request was malformed. Please re-quote.',
  QUOTE_MIN_FILL_BPS_OUT_OF_RANGE:
    'Minimum fill must be between 20% and 50%.',
  QUOTE_MIN_FILL_BPS_STEP_INVALID:
    'Minimum fill must be set in 5% steps.',
  QUOTE_MIN_FILL_BPS_BELOW_FLOOR:
    'This trade is too small for that minimum fill. Increase collateral or raise the minimum fill %.',
  QUOTE_FAK_ORDER_TYPE_DISABLED:
    'Partial fills are temporarily unavailable. Turn off partial fill to continue.',
}

/** Maps a raw API error code to a partial-fill message, or null if unrelated. */
export function partialFillErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  return PARTIAL_FILL_ERROR_MESSAGES[code] ?? null
}
