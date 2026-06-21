// ---------------------------------------------------------------------------
// RUNTIME CONFIG
//
// Single source of truth for the values a hosted demo lets users change at
// runtime: which environment (sandbox vs prod) the UI talks to, and the
// partner API key used to mint JWTs.
//
// Precedence for every getter: sessionStorage override > build-time env >
// sandbox default. sessionStorage (not localStorage) is deliberate — the key
// lives only for the tab's session and is cleared when the tab closes.
//
// Settings are applied by persisting to sessionStorage and reloading the page
// (see applySettings). Every config value below is read once at module load,
// which stays coherent because a change forces a full reload.
// ---------------------------------------------------------------------------

export type DimesEnv = 'sandbox' | 'prod'

export const ENVIRONMENTS: Record<
  DimesEnv,
  { label: string; apiUrl: string; usdcAddress: `0x${string}` }
> = {
  sandbox: {
    label: 'Sandbox',
    apiUrl: 'https://api-sandbox.dimes.fi',
    // Mock USDC on Polygon mainnet.
    usdcAddress: '0xD477EDbe627E94639d7E92119Ca62a461c6ce555',
  },
  prod: {
    label: 'Production',
    apiUrl: 'https://api.dimes.fi',
    // Polymarket USD (pUSD), 6 decimals — the collateral that replaced
    // bridged USDC.e in 2026.
    usdcAddress: '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB',
  },
}

const ENV_KEY = 'dimes.env'
const KEY_KEY = 'dimes.apiKey'
const PRIVY_KEY = 'dimes.privyAppId'
const TK_ORG_KEY = 'dimes.turnkeyOrgId'
const TK_PROXY_KEY = 'dimes.turnkeyAuthProxyConfigId'

function ss(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/** True when the user has pinned an environment via the UI. */
function hasEnvOverride(): boolean {
  const stored = ss()?.getItem(ENV_KEY)
  return stored === 'sandbox' || stored === 'prod'
}

/**
 * Resolved environment: sessionStorage override > inferred from VITE_API_URL >
 * sandbox default.
 */
export function getEnvironment(): DimesEnv {
  const stored = ss()?.getItem(ENV_KEY)
  if (stored === 'sandbox' || stored === 'prod') return stored
  const envUrl = import.meta.env.VITE_API_URL as string | undefined
  if (envUrl?.includes('api.dimes.fi') && !envUrl.includes('sandbox')) return 'prod'
  return 'sandbox'
}

/** True when the resolved environment is the sandbox (mock collateral). */
export function isSandbox(): boolean {
  return getEnvironment() === 'sandbox'
}

/**
 * True when the active collateral token is the sandbox mock USDC — the only
 * token with an open `mint`. This is the correct gate for the faucet button:
 * `getEnvironment()` can say "sandbox" while VITE_USDC_ADDRESS overrides the
 * token to a non-mintable one, in which case the faucet would just revert.
 */
export function isMintableCollateral(): boolean {
  return getUsdcAddress().toLowerCase() === ENVIRONMENTS.sandbox.usdcAddress.toLowerCase()
}

/** API base URL for the resolved environment. */
export function getApiBase(): string {
  if (hasEnvOverride()) return ENVIRONMENTS[getEnvironment()].apiUrl
  return (import.meta.env.VITE_API_URL as string | undefined) || ENVIRONMENTS.sandbox.apiUrl
}

/** Collateral token address for the resolved environment. */
export function getUsdcAddress(): `0x${string}` {
  if (hasEnvOverride()) return ENVIRONMENTS[getEnvironment()].usdcAddress
  return ((import.meta.env.VITE_USDC_ADDRESS as string | undefined) ??
    ENVIRONMENTS.sandbox.usdcAddress) as `0x${string}`
}

/**
 * Partner API key. A stored empty string means the user explicitly chose demo
 * mode and overrides any build-time key.
 */
export function getApiKey(): string {
  const stored = ss()?.getItem(KEY_KEY)
  if (stored != null) return stored.trim()
  return ((import.meta.env.VITE_API_KEY as string | undefined) ?? '').trim()
}

/**
 * Privy app id. When set, the UI swaps its RainbowKit wallet stack for Privy
 * (embedded wallets + Privy login) — the on-chain create/close flow is
 * unchanged because it all runs through wagmi, and Privy provides a wagmi
 * connector. Empty/unset means the default RainbowKit wallet stack.
 *
 * Precedence mirrors getApiKey: sessionStorage override > build-time env.
 */
export function getPrivyAppId(): string {
  const stored = ss()?.getItem(PRIVY_KEY)
  if (stored != null) return stored.trim()
  return ((import.meta.env.VITE_PRIVY_APP_ID as string | undefined) ?? '').trim()
}

/**
 * Turnkey org id + auth-proxy (WalletKit) config id. Both are required to run
 * the Turnkey wallet stack; either missing falls back to the next backend.
 * Both are public client identifiers, not secrets.
 */
export function getTurnkeyOrgId(): string {
  const stored = ss()?.getItem(TK_ORG_KEY)
  if (stored != null) return stored.trim()
  return ((import.meta.env.VITE_TURNKEY_ORG_ID as string | undefined) ?? '').trim()
}

export function getTurnkeyAuthProxyConfigId(): string {
  const stored = ss()?.getItem(TK_PROXY_KEY)
  if (stored != null) return stored.trim()
  return ((import.meta.env.VITE_TURNKEY_AUTH_PROXY_CONFIG_ID as string | undefined) ?? '').trim()
}

/** Optional Turnkey API base URL; defaults to Turnkey's public API. */
export function getTurnkeyApiBaseUrl(): string {
  return (
    (import.meta.env.VITE_TURNKEY_API_BASE_URL as string | undefined) ?? 'https://api.turnkey.com'
  ).trim()
}

export type WalletBackend = 'rainbowkit' | 'privy' | 'turnkey'

/**
 * Which wallet stack mounts. Turnkey wins when fully configured, then Privy,
 * else the default RainbowKit stack. Fixed for the page's lifetime — a settings
 * change forces a reload — so the choice never flips between renders.
 */
export function walletBackend(): WalletBackend {
  if (getTurnkeyOrgId() && getTurnkeyAuthProxyConfigId()) return 'turnkey'
  if (getPrivyAppId()) return 'privy'
  return 'rainbowkit'
}

/** True when a Privy app id is configured (and Turnkey isn't taking priority). */
export function isPrivyMode(): boolean {
  return walletBackend() === 'privy'
}

/** True when Turnkey is fully configured, so the UI should use Turnkey. */
export function isTurnkeyMode(): boolean {
  return walletBackend() === 'turnkey'
}

/**
 * Infer the environment from an API key's prefix. Sandbox keys are
 * `dm_sbx_…`, production keys are `dm_live_…`. Returns null for anything
 * unrecognized (caller falls back to the current environment).
 */
export function detectEnvFromKey(apiKey: string): DimesEnv | null {
  const k = apiKey.trim()
  if (k.startsWith('dm_sbx_')) return 'sandbox'
  if (k.startsWith('dm_live_')) return 'prod'
  return null
}

/**
 * Persist settings to sessionStorage and reload so every module-load constant
 * re-initializes against the new values (the environment switch pins the API
 * base / token address at load). Omitting a field leaves it untouched.
 */
export function applySettings(opts: {
  environment?: DimesEnv
  apiKey?: string
  privyAppId?: string
}): void {
  const s = ss()
  if (!s) return
  if (opts.environment) s.setItem(ENV_KEY, opts.environment)
  if (opts.apiKey !== undefined) {
    const trimmed = opts.apiKey.trim()
    if (trimmed) s.setItem(KEY_KEY, trimmed)
    else s.removeItem(KEY_KEY)
  }
  if (opts.privyAppId !== undefined) {
    const trimmed = opts.privyAppId.trim()
    if (trimmed) s.setItem(PRIVY_KEY, trimmed)
    else s.removeItem(PRIVY_KEY)
  }
  window.location.reload()
}
