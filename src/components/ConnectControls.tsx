import { useEffect, useRef, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { usePrivy, useFundWallet, useExportWallet } from '@privy-io/react-auth'
import { useTurnkey, AuthState } from '@turnkey/react-wallet-kit'
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { formatUnits } from 'viem'
import { getUsdcAddress, walletBackend } from '../runtimeConfig'
import { useDisplayWallet } from '../hooks/useDisplayWallet'
import { useAuthStore } from '../store/auth'

// ---------------------------------------------------------------------------
// CONNECT CONTROLS
//
// One wallet-connect UI with three interchangeable backends, chosen by
// walletBackend() (RainbowKit / Privy / Turnkey). The mode is fixed for the
// page's lifetime — a settings change forces a full reload — so the top-level
// branch below never flips between renders and the per-backend hooks stay
// stable.
//
// `compact` renders the small header pill; the default is the larger Hero CTA.
// Downstream everything reads wagmi, so the on-chain flow doesn't care which
// backend connected the wallet.
// ---------------------------------------------------------------------------

interface MenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}

function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function btnStyle(compact: boolean): React.CSSProperties {
  return {
    padding: compact ? '6px 12px' : '10px 18px',
    fontSize: compact ? 12 : 13,
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
}

export function ConnectControls({ compact = false }: { compact?: boolean }) {
  switch (walletBackend()) {
    case 'turnkey':
      return <TurnkeyControls compact={compact} />
    case 'privy':
      return <PrivyControls compact={compact} />
    default:
      return <RainbowControls compact={compact} />
  }
}

function RainbowControls({ compact }: { compact: boolean }) {
  const displayWallet = useDisplayWallet()
  const base = btnStyle(compact)
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
                      ...base,
                      background: 'var(--yellow)',
                      color: 'var(--yellow-ink)',
                      borderColor: 'var(--yellow)',
                      fontWeight: 700,
                    }}
                  >
                    Connect wallet
                  </button>
                )
              }
              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    style={{
                      ...base,
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
                  <button onClick={openChainModal} type="button" style={base}>
                    {chain.hasIcon && chain.iconUrl && (
                      <img
                        alt={chain.name ?? 'Chain'}
                        src={chain.iconUrl}
                        style={{ width: 14, height: 14, borderRadius: '50%' }}
                      />
                    )}
                    {chain.name}
                  </button>
                  <button onClick={openAccountModal} type="button" style={base}>
                    {displayWallet ? shorten(displayWallet) : account.displayName}
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

function PrivyControls({ compact }: { compact: boolean }) {
  const { ready, authenticated, login } = usePrivy()
  const { address, chain } = useAccount()
  const chainId = useChainId()
  const { chains, switchChain } = useSwitchChain()
  const displayWallet = useDisplayWallet()
  const smartWalletAddress = useAuthStore((s) => s.smartWalletAddress)
  const base = btnStyle(compact)

  // With an AA smart wallet the owner EOA may not be wired into wagmi, so fall
  // back to the smart-account address for the connected state + pill.
  const activeAddress = (address ?? smartWalletAddress ?? undefined) as `0x${string}` | undefined
  const expectedChainId = chains[0]?.id
  const connected = ready && authenticated && !!activeAddress
  // Chain check only applies when wagmi actually has the account wired up.
  const wrongNetwork = connected && !!address && expectedChainId != null && chainId !== expectedChainId

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
              onClick={login}
              type="button"
              style={{
                ...base,
                background: 'var(--yellow)',
                color: 'var(--yellow-ink)',
                borderColor: 'var(--yellow)',
                fontWeight: 700,
              }}
            >
              Connect wallet
            </button>
          )
        }
        if (wrongNetwork) {
          return (
            <button
              onClick={() => switchChain({ chainId: expectedChainId })}
              type="button"
              style={{
                ...base,
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
            <button type="button" style={{ ...base, cursor: 'default' }} disabled>
              {chain?.name ?? 'Polygon'}
            </button>
            <PrivyAccountMenu
              address={activeAddress!}
              label={shorten(displayWallet ?? activeAddress!)}
              base={base}
            />
          </>
        )
      })()}
    </div>
  )
}

const USDC_ADDRESS = getUsdcAddress()

/**
 * Account pill (our styling) that opens a small dropdown: full address + copy,
 * USDC balance, then backend-specific actions (fund / export / disconnect).
 * Shared by Privy and Turnkey so both keep the app's squared look without
 * depending on either SDK's own account UI.
 */
function AccountMenuShell({
  address,
  label,
  base,
  actions,
}: {
  address: `0x${string}`
  label: string
  base: React.CSSProperties
  actions: MenuAction[]
}) {
  const { data: balance } = useBalance({
    address,
    token: USDC_ADDRESS,
    query: { enabled: !!address && !!USDC_ADDRESS },
  })
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    fontSize: 12,
    fontWeight: 600,
    fontFamily: 'var(--font)',
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" style={base} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 220,
            background: 'var(--card-elevated)',
            border: '1px solid var(--card-border)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 50,
            fontFamily: 'var(--font)',
          }}
        >
          <button
            type="button"
            onClick={copy}
            title="Copy address"
            style={{ ...itemStyle, borderBottom: '1px solid var(--border)' }}
          >
            <span style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 600 }}>
              {copied ? 'COPIED' : 'ADDRESS'}
            </span>
            <br />
            <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{shorten(address)}</span>
          </button>
          <div style={{ ...itemStyle, cursor: 'default', borderBottom: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--text-dim)', fontSize: 10, fontWeight: 600 }}>BALANCE</span>
            <br />
            <span style={{ fontWeight: 500 }}>
              {balance
                ? `${Number(formatUnits(balance.value, balance.decimals)).toLocaleString()} ${balance.symbol}`
                : '—'}
            </span>
          </div>
          {actions.map((a, i) => (
            <button
              key={a.label}
              type="button"
              onClick={() => {
                setOpen(false)
                a.onClick()
              }}
              style={{
                ...itemStyle,
                color: a.danger ? 'var(--red)' : 'var(--text)',
                borderTop: i === actions.length - 1 ? '1px solid var(--border)' : undefined,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PrivyAccountMenu({
  address,
  label,
  base,
}: {
  address: `0x${string}`
  label: string
  base: React.CSSProperties
}) {
  const { user, logout } = usePrivy()
  const { fundWallet } = useFundWallet()
  const { exportWallet } = useExportWallet()

  // Export only applies to Privy embedded wallets; external wallets keep keys.
  const isEmbedded = user?.wallet?.walletClientType === 'privy'

  // Logout = Privy logout() only. The SmartWalletBridge tears down wagmi + the
  // scoped auth once Privy flips to unauthenticated (doing it here would
  // interrupt logout and leave Privy half-logged-in).
  const actions: MenuAction[] = [
    { label: 'Fund wallet', onClick: () => void fundWallet({ address }) },
    ...(isEmbedded
      ? [{ label: 'Export wallet key', onClick: () => void exportWallet({ address }) }]
      : []),
    { label: 'Disconnect', onClick: () => void logout(), danger: true },
  ]

  return <AccountMenuShell address={address} label={label} base={base} actions={actions} />
}

// react-wallet-kit's published context type omits `logout` (the runtime exposes
// it), so reach it through a narrow cast.
interface TurnkeyLogout {
  logout?: () => Promise<void>
}

function TurnkeyControls({ compact }: { compact: boolean }) {
  const tk = useTurnkey()
  const { authState, handleLogin, wallets } = tk
  const { address } = useAccount()
  const displayWallet = useDisplayWallet()
  const base = btnStyle(compact)

  const connected = authState === AuthState.Authenticated && !!address

  if (!connected) {
    return (
      <div style={{ display: 'inline-flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => void handleLogin()}
          style={{
            ...base,
            background: 'var(--yellow)',
            color: 'var(--yellow-ink)',
            borderColor: 'var(--yellow)',
            fontWeight: 700,
          }}
        >
          Connect wallet
        </button>
      </div>
    )
  }

  const walletId = wallets?.[0]?.walletId
  const logout = (tk as unknown as TurnkeyLogout).logout
  const actions: MenuAction[] = [
    ...(walletId
      ? [{ label: 'Export wallet key', onClick: () => void tk.handleExportWallet({ walletId }) }]
      : []),
    { label: 'Disconnect', onClick: () => void logout?.(), danger: true },
  ]

  return (
    <div style={{ display: 'inline-flex', gap: 8 }}>
      <button type="button" style={{ ...base, cursor: 'default' }} disabled>
        Polygon
      </button>
      <AccountMenuShell
        address={address!}
        label={shorten(displayWallet ?? address!)}
        base={base}
        actions={actions}
      />
    </div>
  )
}
