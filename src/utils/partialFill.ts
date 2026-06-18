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

/** Error `details` (camelCase, as transformed by the API client). */
export type PartialFillErrorParams = Record<string, unknown> | null | undefined

type PartialFillErrorEntry = string | ((params: PartialFillErrorParams) => string)

function readNumber(params: PartialFillErrorParams, key: string): number | null {
  const raw = params ? params[key] : undefined
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  return Number.isFinite(n) ? n : null
}

/**
 * The floor-cap rejection (`QUOTE_MIN_FILL_BPS_BELOW_FLOOR`) carries `boundBy`
 * ("collateral" | "notional") and `floorMinFillBps` — the smallest minimum-fill
 * that would be accepted at this size. We surface both so the message tells the
 * user exactly how to fix it.
 */
function belowFloorMessage(params: PartialFillErrorParams): string {
  const limit = params?.boundBy === 'notional' ? 'minimum order size' : 'minimum collateral'
  const floor = readNumber(params, 'floorMinFillBps')
  if (floor == null || floor > MIN_FILL_BPS_MAX) {
    return `This trade is too small for a partial fill without falling below the ${limit}. Increase your trade size, or turn off partial fill to open atomically.`
  }
  return `This trade is too small for that minimum fill — a partial fill could fall below the ${limit}. Raise the minimum fill to at least ${formatFillPct(floor)}, or increase your trade size.`
}

/**
 * Rejection codes specific to partial-open. Range/step are pre-validated by the
 * slider, so in practice only the floor-cap and kill-switch codes surface — but
 * we map all of them so a stale/edge request still reads cleanly.
 */
export const PARTIAL_FILL_ERROR_MESSAGES: Record<string, PartialFillErrorEntry> = {
  QUOTE_MIN_FILL_BPS_REQUIRES_FAK:
    'Partial-fill request was malformed. Please re-quote.',
  QUOTE_MIN_FILL_BPS_OUT_OF_RANGE:
    'Minimum fill must be between 20% and 50%.',
  QUOTE_MIN_FILL_BPS_STEP_INVALID:
    'Minimum fill must be set in 5% steps.',
  QUOTE_MIN_FILL_BPS_BELOW_FLOOR: belowFloorMessage,
  QUOTE_FAK_ORDER_TYPE_DISABLED:
    'Partial fills are temporarily unavailable. Turn off partial fill to continue.',
}

/** Maps a raw API error code to a partial-fill message, or null if unrelated. */
export function partialFillErrorMessage(
  code: string | null | undefined,
  params?: PartialFillErrorParams,
): string | null {
  if (!code) return null
  const entry = PARTIAL_FILL_ERROR_MESSAGES[code]
  if (entry == null) return null
  return typeof entry === 'function' ? entry(params) : entry
}
