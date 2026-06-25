import { useState, useEffect } from 'react'
import { useAccount, useBalance } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { useWalletKind } from '../contract/useWalletKind'
import { useDepositWallet } from '../contract/useDepositWallet'
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
  const depositWalletMode = useAuthStore((s) => s.depositWalletMode)
  const depositWalletAddress = useAuthStore((s) => s.depositWalletAddress)
  // Show the balance of the wallet positions actually open from — the smart
  // account when AA is active, the deposit wallet in deposit mode, else the EOA.
  const address = (smartWalletAddress ??
    (depositWalletMode ? depositWalletAddress : null) ??
    eoa) as `0x${string}` | undefined
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
  border: 'none',
}

const dot = (color: string): React.CSSProperties => ({
  width: 6,
  height: 6,
  borderRadius: '50%',
  background: color,
})

/** Badge whose text toggles the active wallet, with an optional copy control. */
function ToggleBadge({
  style,
  dotColor,
  title,
  label,
  onToggle,
  copyAddress,
}: {
  style: React.CSSProperties
  dotColor: string
  title: string
  label: string
  onToggle: () => void
  copyAddress?: string
}) {
  return (
    <span style={style}>
      <button
        type="button"
        onClick={onToggle}
        title={title}
        style={{
          padding: 0,
          background: 'none',
          border: 'none',
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <span style={dot(dotColor)} />
        {label}
      </button>
      {copyAddress && <CopyAddress address={copyAddress} color="currentColor" />}
    </span>
  )
}

/** Small inline copy-to-clipboard control, used inside wallet badges. */
function CopyAddress({ address, color }: { address: string; color: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(address)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      title={copied ? 'Copied' : `Copy ${address}`}
      aria-label={`Copy address ${address}`}
      style={{
        padding: 0,
        marginLeft: 2,
        background: 'none',
        border: 'none',
        color,
        cursor: 'pointer',
        fontFamily: 'var(--font)',
        fontSize: 12,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
      }}
    >
      {copied ? '✓' : '⧉'}
    </button>
  )
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
      title: `Minted ${MINT_AMOUNT.toLocaleString()} test sUSDC`,
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
      error: err,
      context: { action: 'mint', amount: MINT_AMOUNT },
    })
    reset()
  }, [simulateError, error, receiptError, addToast, reset])

  return (
    <button
      type="button"
      onClick={() => mint(MINT_AMOUNT)}
      disabled={busy}
      title="Mint test sUSDC to your wallet (sandbox only)"
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
      {isConfirming ? 'Minting…' : isPending ? 'Confirm in wallet…' : 'Get test sUSDC'}
    </button>
  )
}

/**
 * Active-wallet badge. The flow is chosen explicitly (home-page buttons / this
 * badge), not auto-detected:
 *
 * - EOA mode → shows the connected wallet (EOA / Safe / smart-contract label).
 * - Deposit mode → scoped to the Polymarket deposit wallet. Yellow when the
 *   deposit wallet is deployed + owned by the connection; red "No deposit
 *   wallet" when the user asked for it but none is available (wrong chain or not
 *   yet deployed) — quotes still scope to its deterministic address.
 *
 * Clicking the badge toggles between EOA and deposit wallet.
 */
function WalletKindBadge() {
  const { kind, isLoading: kindLoading } = useWalletKind()
  // In EOA mode we describe the connection itself, not the deposit wallet it may
  // own — so map the deposit-owner kind back to its underlying EOA label.
  const eoaLabel =
    kind === 'safe' ? 'Gnosis Safe' : kind === 'smart-contract' ? 'Smart-contract wallet' : 'EOA'
  const { address } = useAccount()
  const wantsDepositWallet = useAuthStore((s) => s.wantsDepositWallet)
  const setWantsDepositWallet = useAuthStore((s) => s.setWantsDepositWallet)
  const smartWalletAddress = useAuthStore((s) => s.smartWalletAddress)
  const deposit = useDepositWallet()

  // A Privy AA smart account is the on-chain wallet — it isn't a deposit-wallet
  // owner, so the EOA/deposit toggle doesn't apply.
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

  if (!address) return null

  const toggle = () => setWantsDepositWallet(!wantsDepositWallet)
  const otherLabel = wantsDepositWallet ? 'connected EOA' : 'deposit wallet'

  // Deposit-wallet mode.
  if (wantsDepositWallet) {
    if (deposit.isLoading) {
      return (
        <ToggleBadge
          onToggle={toggle}
          title="Resolving deposit wallet… Click to switch to the connected EOA."
          style={{ ...baseBadge, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-dim)' }}
          dotColor="var(--text-dim)"
          label="Resolving deposit wallet…"
        />
      )
    }
    if (deposit.available && deposit.address) {
      return (
        <ToggleBadge
          onToggle={toggle}
          title={`Push-funded flow active — quotes and positions scoped to deposit wallet ${deposit.address}. Click to switch to the ${otherLabel}.`}
          style={{ ...baseBadge, background: 'var(--yellow)', color: 'var(--yellow-ink)' }}
          dotColor="var(--yellow-ink)"
          label={`Deposit Wallet · ${shortenAddress(deposit.address)}`}
          copyAddress={deposit.address}
        />
      )
    }
    // Asked for the deposit wallet but none is available. The address is still
    // derivable (CREATE2) — expose it so the owner can fund/deploy it.
    return (
      <ToggleBadge
        onToggle={toggle}
        title={
          deposit.chainSupported
            ? `No Polymarket deposit wallet is deployed for ${address}. Quotes scope to its address once funded. Click to switch to the ${otherLabel}.`
            : `Polymarket deposit wallets only exist on Polygon. Click to switch to the ${otherLabel}.`
        }
        style={{ ...baseBadge, border: '1px solid var(--red)', background: 'rgba(224,82,82,0.08)', color: 'var(--red)' }}
        dotColor="var(--red)"
        label="No deposit wallet"
        copyAddress={deposit.chainSupported ? deposit.address : undefined}
      />
    )
  }

  // EOA mode — show the connected wallet.
  if (kindLoading) {
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
  return (
    <ToggleBadge
      onToggle={toggle}
      title={`Trading as ${eoaLabel} ${address}. Click to switch to the ${otherLabel}.`}
      style={{ ...baseBadge, border: '1px solid var(--border)', background: 'var(--surface-subtle)', color: 'var(--text)' }}
      dotColor="var(--text-dim)"
      label={`${eoaLabel} · ${shortenAddress(address)}`}
      copyAddress={address}
    />
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
  const { isConnected } = useAccount()
  // Until an API key is set there's no environment/balance to act on, so hide
  // the settings, faucet and balance controls. (Key changes force a reload, so
  // reading it at render stays coherent.)
  const hasApiKey = Boolean(getApiKey())

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
        <CompactConnectButton />
      </div>
    </header>
  )
}
