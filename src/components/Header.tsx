import { useState, useEffect, useRef } from 'react'
import { useDisconnect, useAccount, useBalance } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { useWalletKind } from '../contract/useWalletKind'
import { useMintSandboxUsdc } from '../contract/hooks'
import { ConnectControls } from './ConnectControls'
import { useToastStore } from '../store/toasts'
import { formatContractError } from '../contract/error-messages'
import {
  ENVIRONMENTS,
  applySettings,
  detectEnvFromKey,
  getApiKey,
  getEnvironment,
  getUsdcAddress,
  isSandbox,
} from '../runtimeConfig'

function CompactConnectButton() {
  return <ConnectControls compact />
}

const USDC_ADDRESS = getUsdcAddress()

function UsdcBalance() {
  const { address: eoa } = useAccount()
  const smartWalletAddress = useAuthStore((s) => s.smartWalletAddress)
  // Show the balance of the wallet positions actually open from — the smart
  // account when AA is active, else the connected EOA.
  const address = (smartWalletAddress ?? eoa) as `0x${string}` | undefined
  const { data } = useBalance({
    address,
    token: USDC_ADDRESS,
    query: { enabled: !!address && !!USDC_ADDRESS },
  })

  if (!data) return null

  const amount = Number(data.value) / 10 ** data.decimals
  const formatted = amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <span
      style={{
        padding: '8px 12px',
        fontSize: 'var(--fs-sm)',
        fontWeight: 600,
        color: 'var(--text)',
        background: 'var(--surface-subtle)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 0,
      }}
    >
      {formatted} {data.symbol}
    </span>
  )
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

const MINT_AMOUNT = 10_000n

/**
 * Sandbox faucet button. The mock collateral token has an open mint, so this
 * lets any connected wallet top itself up with test pUSD. Rendered only in the
 * sandbox environment (see Header). On success the balance query is invalidated
 * so the header balance refreshes.
 */
function MintUsdcButton() {
  const { mint, isPending, isConfirming, isSuccess, error, receiptError, simulateError, reset } =
    useMintSandboxUsdc()
  const queryClient = useQueryClient()
  const addToast = useToastStore((s) => s.add)
  const busy = isPending || isConfirming

  // Pop the button when the wallet has no collateral — that's exactly when a
  // user needs the faucet to do anything. Checks the effective wallet (smart
  // account under AA), which is where the faucet now mints.
  const { address: eoa } = useAccount()
  const smartWalletAddress = useAuthStore((s) => s.smartWalletAddress)
  const address = (smartWalletAddress ?? eoa) as `0x${string}` | undefined
  const { data: balance } = useBalance({
    address,
    token: USDC_ADDRESS,
    query: { enabled: !!address && !!USDC_ADDRESS },
  })
  // "Empty" = whatever the header shows as 0.00. Strict `=== 0n` misses dust
  // (a few units left over from trades) that still renders as a zero balance.
  // The balance shows 2 dp, so anything under 0.005 tokens rounds to 0.00.
  const isEmpty =
    balance != null && balance.value * 200n < 10n ** BigInt(balance.decimals)

  useEffect(() => {
    if (!isSuccess) return
    queryClient.invalidateQueries()
    addToast({
      title: `Minted ${MINT_AMOUNT.toLocaleString()} test pUSD`,
      variant: 'success',
      durationMs: 4000,
    })
    reset()
  }, [isSuccess, queryClient, addToast, reset])

  useEffect(() => {
    const err = simulateError ?? error ?? receiptError
    if (!err) return
    addToast({
      title: 'Mint failed',
      description: formatContractError(err).message,
      variant: 'error',
      durationMs: 6000,
    })
    reset()
  }, [simulateError, error, receiptError, addToast, reset])

  return (
    <button
      type="button"
      onClick={() => mint(MINT_AMOUNT)}
      disabled={busy}
      title="Mint test pUSD to your wallet (sandbox only)"
      style={{
        padding: '8px 12px',
        fontSize: 'var(--fs-sm)',
        fontWeight: isEmpty ? 700 : 600,
        borderRadius: 0,
        border: `1px solid ${isEmpty ? 'var(--yellow-border)' : 'var(--border)'}`,
        background: isEmpty ? 'var(--yellow-soft)' : 'var(--surface-subtle)',
        color: isEmpty ? 'var(--yellow)' : 'var(--text)',
        cursor: busy ? 'not-allowed' : 'pointer',
        fontFamily: 'var(--font)',
        lineHeight: 1.2,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {isConfirming ? 'Minting…' : isPending ? 'Confirm in wallet…' : 'Get test pUSD'}
    </button>
  )
}

/**
 * Opt-in toggle for the Polymarket deposit-wallet (push-funded) flow. When the
 * connected wallet has no deposit wallet, a disabled placeholder is shown so
 * the capability is still discoverable.
 */
/**
 * Detects the connected wallet's type and routes the opening flow automatically:
 *
 * - A deployed Polymarket deposit wallet → auto-enables the push-funded relayer
 *   flow (the one case a direct `approve` can't satisfy). Stays a toggle so the
 *   owner can fall back to trading as a plain EOA.
 * - EOA / Gnosis Safe / other smart-contract wallet → the direct flow already
 *   works (the wallet's own provider relays the vault calls), so this just shows
 *   the detected type as a static badge.
 */
function WalletKindBadge() {
  const { kind, isLoading, depositWalletAddress, label } = useWalletKind()
  const depositWalletMode = useAuthStore((s) => s.depositWalletMode)
  const setDepositWalletMode = useAuthStore((s) => s.setDepositWalletMode)
  const smartWalletAddress = useAuthStore((s) => s.smartWalletAddress)
  const { address } = useAccount()

  // Auto-enable the push-funded flow once per address when a deposit wallet is
  // detected. Tracking the applied address lets the user toggle back off without
  // the effect immediately re-enabling it.
  const autoAppliedFor = useRef<string | null>(null)
  useEffect(() => {
    if (kind === 'deposit-owner' && depositWalletAddress && autoAppliedFor.current !== address) {
      autoAppliedFor.current = address ?? null
      if (!depositWalletMode) setDepositWalletMode(true, depositWalletAddress)
    }
    if (!address) autoAppliedFor.current = null
  }, [kind, depositWalletAddress, address, depositWalletMode, setDepositWalletMode])

  const baseBadge: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 0,
    fontFamily: 'var(--font)',
    lineHeight: 1.2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }
  const dot = (color: string): React.CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: color,
  })

  // A Privy AA smart account is the on-chain wallet — takes priority over the
  // wagmi-address-based detection (which would see the embedded owner EOA).
  if (smartWalletAddress) {
    return (
      <span
        title={`Privy smart account (ERC-4337). Positions open as a single gasless userOp, with ${smartWalletAddress} as msg.sender.`}
        style={{
          ...baseBadge,
          border: '1px solid var(--green-border)',
          background: 'var(--green-soft)',
          color: 'var(--green)',
          cursor: 'help',
        }}
      >
        <span style={dot('var(--green)')} />
        {`Smart Account (AA) · ${shortenAddress(smartWalletAddress)}`}
      </span>
    )
  }

  if (isLoading) {
    return (
      <span
        title="Detecting wallet type…"
        style={{ ...baseBadge, border: '1px dashed var(--border)', color: 'var(--text-dim)', cursor: 'help' }}
      >
        <span style={dot('var(--text-dim)')} />
        Detecting wallet…
      </span>
    )
  }

  // Deposit-wallet owner → read-only status (selecting the flow is a home-page
  // action now; this is just the active-state indicator). Deposit mode
  // auto-enables on detection.
  if (kind === 'deposit-owner' && depositWalletAddress) {
    const active = depositWalletMode
    return (
      <span
        title={
          active
            ? `Push-funded flow active — quotes and positions scoped to deposit wallet ${depositWalletAddress}.`
            : `A Polymarket deposit wallet (${depositWalletAddress}) is available for this owner.`
        }
        style={{
          ...baseBadge,
          border: `1px solid ${active ? 'var(--yellow)' : 'var(--border)'}`,
          background: active ? 'var(--yellow)' : 'var(--surface-subtle)',
          color: active ? 'var(--yellow-ink)' : 'var(--text)',
          cursor: 'help',
        }}
      >
        <span style={dot(active ? 'var(--yellow-ink)' : 'var(--text-dim)')} />
        {active
          ? `Deposit Wallet · ${shortenAddress(depositWalletAddress)}`
          : 'Owner EOA · deposit wallet available'}
      </span>
    )
  }

  // EOA / Safe / other smart-contract wallet → static type badge. Contract
  // wallets get a subtle accent to show the demo recognized them.
  const isContract = kind === 'safe' || kind === 'smart-contract'
  return (
    <span
      title={
        isContract
          ? `Detected a ${label}. Vault calls are relayed by the wallet — the direct open/close flow runs with this contract as msg.sender.`
          : 'Plain EOA — direct approve + createPosition flow.'
      }
      style={{
        ...baseBadge,
        border: `1px solid ${isContract ? 'var(--border-strong)' : 'var(--border)'}`,
        background: 'var(--surface-subtle)',
        color: isContract ? 'var(--text)' : 'var(--text-muted)',
        cursor: 'help',
      }}
    >
      <span style={dot(isContract ? 'var(--green)' : 'var(--text-dim)')} />
      {label}
    </span>
  )
}

/**
 * Runtime settings: set the partner API key (stored in sessionStorage, this
 * tab only, cleared on close — never logged). The environment is inferred from
 * the key prefix (dm_sbx_ → sandbox, dm_live_ → prod) and applied on save by
 * reloading the page. See runtimeConfig.
 */
function SettingsControl() {
  const [open, setOpen] = useState(false)
  const [apiKey, setApiKey] = useState(getApiKey())

  // Environment the entered key maps to (falls back to the current one).
  const pendingEnv = detectEnvFromKey(apiKey) ?? getEnvironment()

  const baseBtn: React.CSSProperties = {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 0,
    border: '1px solid var(--border)',
    background: 'var(--surface-subtle)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
    lineHeight: 1.2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
  }

  const fieldStyle: React.CSSProperties = {
    width: '100%',
    padding: '8px 10px',
    fontSize: 13,
    borderRadius: 0,
    border: '1px solid var(--border)',
    background: 'var(--surface-subtle)',
    color: 'var(--text)',
    fontFamily: 'var(--font)',
    boxSizing: 'border-box',
  }

  const save = () => {
    applySettings({ environment: pendingEnv, apiKey })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Settings — API key & environment"
        aria-label="Settings"
        aria-expanded={open}
        style={baseBtn}
      >
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>⚙</span>
        {ENVIRONMENTS[getEnvironment()].label}
      </button>

      {open && (
        <>
          {/* click-away backdrop */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
          />
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              zIndex: 50,
              width: 320,
              padding: 16,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 0,
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                API Key
              </span>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="dm_…"
                autoComplete="off"
                spellCheck={false}
                style={fieldStyle}
              />
              <span style={{ fontSize: 11, lineHeight: 1.4, color: 'var(--text-dim)' }}>
                Environment: <strong style={{ color: 'var(--text)' }}>{ENVIRONMENTS[pendingEnv].label}</strong> (detected from key).
                Stored in this tab's session only, cleared when you close the tab.
              </span>
            </label>

            <button
              type="button"
              onClick={save}
              className="btn"
              style={{
                ...baseBtn,
                justifyContent: 'center',
                background: 'var(--yellow)',
                color: 'var(--yellow-ink)',
                borderColor: 'var(--yellow)',
                fontWeight: 700,
                padding: '8px 14px',
              }}
            >
              Save & reload
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function DimesLogo() {
  return (
    <img
      src="/logo-dark.png"
      alt="Dimes"
      style={{ height: 36, width: 'auto', display: 'block', marginLeft: -6 }}
    />
  )
}

export function Header() {
  const { disconnect } = useDisconnect()
  const { isConnected } = useAccount()
  const clearAuth = useAuthStore((state) => state.clearAuth)
  // Until an API key is set there's no environment/balance to act on, so hide
  // the settings, faucet and balance controls. (Key changes force a reload, so
  // reading it at render stays coherent.)
  const hasApiKey = Boolean(getApiKey())

  const handleLogout = () => {
    clearAuth()
    disconnect()
  }

  return (
    <header
      className="header-row"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '20px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DimesLogo />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {hasApiKey && <SettingsControl />}
        {isConnected && <WalletKindBadge />}
        {isConnected && hasApiKey && isSandbox() && <MintUsdcButton />}
        {isConnected && hasApiKey && <UsdcBalance />}
        {isConnected && (
          <button
            type="button"
            onClick={handleLogout}
            className="btn btn--ghost"
            style={{ padding: '8px 14px', fontSize: 'var(--fs-sm)' }}
          >
            Logout
          </button>
        )}
        <CompactConnectButton />
      </div>
    </header>
  )
}
