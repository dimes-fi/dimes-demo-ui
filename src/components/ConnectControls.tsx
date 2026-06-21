import { useEffect, useRef, useState } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { usePrivy, useFundWallet, useExportWallet } from '@privy-io/react-auth'
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi'
import { formatUnits } from 'viem'
import { getUsdcAddress, isPrivyMode } from '../runtimeConfig'
import { useDisplayWallet } from '../hooks/useDisplayWallet'

// ---------------------------------------------------------------------------
// CONNECT CONTROLS
//
// One wallet-connect UI with two interchangeable backends, chosen by
// isPrivyMode() (driven by VITE_PRIVY_APP_ID). The mode is fixed for the page's
// lifetime — a settings change forces a full reload — so the top-level branch
// below never flips between renders and the per-backend hooks stay stable.
//
// `compact` renders the small header pill; the default is the larger Hero CTA.
// Both backends produce the same three-state layout: connect → wrong-network →
// connected (chain + account). Downstream everything reads wagmi, so the
// on-chain flow doesn't care which backend connected the wallet.
// ---------------------------------------------------------------------------

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
  return isPrivyMode() ? <PrivyControls compact={compact} /> : <RainbowControls compact={compact} />
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
  const base = btnStyle(compact)

  const expectedChainId = chains[0]?.id
  const connected = ready && authenticated && !!address
  const wrongNetwork = connected && expectedChainId != null && chainId !== expectedChainId

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
            <PrivyAccountMenu address={address!} label={shorten(displayWallet ?? address!)} base={base} />
          </>
        )
      })()}
    </div>
  )
}

const USDC_ADDRESS = getUsdcAddress()

/**
 * Account pill (our styling) that opens a small dropdown over Privy's *typed*
 * actions — full address + copy, USDC balance, fund, export (embedded wallets
 * only), disconnect. Deliberately not Privy's WalletsDialog: that has no public
 * open trigger, so we reproduce its contents to keep the app's squared look.
 */
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
  const { data: balance } = useBalance({
    address,
    token: USDC_ADDRESS,
    query: { enabled: !!address && !!USDC_ADDRESS },
  })
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Export only applies to Privy embedded wallets; external wallets keep keys.
  const isEmbedded = user?.wallet?.walletClientType === 'privy'

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
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void fundWallet({ address })
            }}
            style={itemStyle}
          >
            Fund wallet
          </button>
          {isEmbedded && (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                void exportWallet({ address })
              }}
              style={itemStyle}
            >
              Export wallet key
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
            style={{ ...itemStyle, color: 'var(--red)', borderTop: '1px solid var(--border)' }}
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
