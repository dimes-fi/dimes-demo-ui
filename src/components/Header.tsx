import { useState, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useDisconnect, useAccount, useBalance } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/auth'
import { useDepositWallet } from '../contract/useDepositWallet'
import { useMintSandboxUsdc } from '../contract/hooks'
import { useDisplayWallet } from '../hooks/useDisplayWallet'
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
  const displayWallet = useDisplayWallet()
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
    transition: 'background 0.15s ease, border-color 0.15s ease',
  }

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted
        const connected = ready && account && chain
        return (
          <div
            style={{
              opacity: !ready ? 0 : 1,
              pointerEvents: !ready ? 'none' : undefined,
              userSelect: !ready ? 'none' : undefined,
              display: 'inline-flex',
              gap: 8,
            }}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    style={{
                      ...baseBtn,
                      background: 'var(--yellow)',
                      color: 'var(--yellow-ink)',
                      borderColor: 'var(--yellow)',
                      fontWeight: 700,
                    }}
                  >
                    Connect Wallet
                  </button>
                )
              }
              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    style={{
                      ...baseBtn,
                      background: 'rgba(224,82,82,0.08)',
                      color: 'var(--red)',
                      borderColor: 'rgba(224,82,82,0.3)',
                    }}
                  >
                    Wrong network
                  </button>
                )
              }
              return (
                <>
                  <button
                    onClick={openChainModal}
                    type="button"
                    style={baseBtn}
                  >
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain'}
                        src={chain.iconUrl}
                        style={{ width: 14, height: 14, borderRadius: '50%' }}
                      />
                    )}
                    {chain.name}
                  </button>
                  <button
                    onClick={openAccountModal}
                    type="button"
                    style={baseBtn}
                  >
                    {displayWallet ? shortenAddress(displayWallet) : account.displayName}
                  </button>
                </>
              )
            })()}
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}

const USDC_ADDRESS = getUsdcAddress()

function UsdcBalance() {
  const { address } = useAccount()
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
 * lets any connected wallet top itself up with test USDC. Rendered only in the
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
  // user needs the faucet to do anything.
  const { address } = useAccount()
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
      title: `Minted ${MINT_AMOUNT.toLocaleString()} sUSDC`,
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
      title="Mint test USDC to your wallet (sandbox only)"
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
      {isConfirming ? 'Minting…' : isPending ? 'Confirm in wallet…' : 'Get test USDC'}
    </button>
  )
}

/**
 * Opt-in toggle for the Polymarket deposit-wallet (push-funded) flow. When the
 * connected wallet has no deposit wallet, a disabled placeholder is shown so
 * the capability is still discoverable.
 */
function DepositWalletToggle() {
  const { available, address: depositWalletAddress, isLoading, chainSupported } = useDepositWallet()
  const depositWalletMode = useAuthStore((s) => s.depositWalletMode)
  const setDepositWalletMode = useAuthStore((s) => s.setDepositWalletMode)

  // The deposit-wallet flow only exists on Polygon mainnet.
  if (!chainSupported) return null

  if (isLoading || !available || !depositWalletAddress) {
    return (
      <span
        title={
          isLoading
            ? 'Checking for a Polymarket deposit wallet…'
            : 'No Polymarket deposit wallet is deployed for the connected wallet. The push-funded flow is unavailable.'
        }
        style={{
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 600,
          borderRadius: 0,
          border: '1px dashed var(--border)',
          background: 'transparent',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font)',
          lineHeight: 1.2,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'help',
        }}
      >
        <span
          style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-dim)', opacity: 0.5 }}
        />
        {isLoading ? 'Checking deposit wallet…' : 'No Deposit Wallet'}
      </span>
    )
  }

  const toggle = () => {
    if (depositWalletMode) {
      setDepositWalletMode(false, null)
    } else {
      setDepositWalletMode(true, depositWalletAddress)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={
        depositWalletMode
          ? `Push-funded flow active — quotes and positions are scoped to deposit wallet ${depositWalletAddress}`
          : `A Polymarket deposit wallet (${depositWalletAddress}) is available for this wallet. Enable the push-funded flow.`
      }
      style={{
        padding: '6px 12px',
        fontSize: 12,
        fontWeight: 600,
        borderRadius: 0,
        border: `1px solid ${depositWalletMode ? 'var(--yellow)' : 'var(--border)'}`,
        background: depositWalletMode ? 'var(--yellow)' : 'var(--surface-subtle)',
        color: depositWalletMode ? 'var(--yellow-ink)' : 'var(--text)',
        cursor: 'pointer',
        fontFamily: 'var(--font)',
        lineHeight: 1.2,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: depositWalletMode ? 'var(--yellow-ink)' : 'var(--text-dim)',
        }}
      />
      {depositWalletMode ? `Deposit Wallet · ${shortenAddress(depositWalletAddress)}` : 'Use Deposit Wallet'}
    </button>
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
        {isConnected && <DepositWalletToggle />}
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
