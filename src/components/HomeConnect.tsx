import { lazy, Suspense, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { usePrivy } from '@privy-io/react-auth'
import {
  walletBackend,
  isBackendConfigured,
  selectBackend,
  consumeAutoConnect,
  type WalletBackend,
} from '../runtimeConfig'
import { primaryBtn, secondaryBtn } from './connectShared'

// ---------------------------------------------------------------------------
// HOME CONNECT
//
// The pre-connect home page. Privy and Turnkey can't co-mount (each owns the
// wagmi connection), so this is a selector: the active stack offers its native
// connect options, and any other configured backend offers a "switch" button
// that persists the choice and reloads into that stack (auto-opening its
// connect flow). External wallets ride the active stack — Privy's
// `connectWallet()` or RainbowKit's modal — so no separate stack is needed for
// "connect a wallet".
// ---------------------------------------------------------------------------

const comingSoonBtn: React.CSSProperties = {
  padding: '11px 18px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 0,
  border: '1px dashed var(--border)',
  background: 'transparent',
  color: 'var(--text-dim)',
  cursor: 'not-allowed',
  fontFamily: 'var(--font)',
  lineHeight: 1.2,
  width: '100%',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

/** Turnkey isn't shipped yet — show it as a disabled "coming soon" affordance. */
function TurnkeyComingSoon() {
  return (
    <button type="button" style={comingSoonBtn} disabled title="Turnkey support is coming soon">
      Connect with Turnkey
      <span style={{ fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
        Coming soon
      </span>
    </button>
  )
}

export function Stack({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 300, maxWidth: '100%' }}>
      {children}
    </div>
  )
}

/** "Switch to another configured backend" button — persists + reloads. */
export function SwitchButton({ to, label }: { to: WalletBackend; label: string }) {
  if (!isBackendConfigured(to)) return null
  return (
    <button type="button" style={secondaryBtn} onClick={() => selectBackend(to)}>
      {label}
    </button>
  )
}

/** Connect through a Polymarket deposit wallet. Connecting the owner wallet is
 *  enough — `useWalletKind` detects the deposit wallet and auto-routes the
 *  push-funded flow. */
function DepositWalletButton({ onConnectOwner }: { onConnectOwner: () => void }) {
  return (
    <button
      type="button"
      style={secondaryBtn}
      onClick={onConnectOwner}
      title="Connect the wallet that owns a Polymarket deposit wallet — the app detects it and routes the push-funded flow."
    >
      Polymarket deposit wallet
    </button>
  )
}

// Lazy so @turnkey/react-wallet-kit (throws at module-eval when bundled for
// web) is only evaluated when Turnkey is the active backend.
const TurnkeyHome = lazy(() => import('../turnkey/TurnkeyHome'))

export function HomeConnect() {
  switch (walletBackend()) {
    case 'privy':
      return <PrivyHome />
    case 'turnkey':
      return (
        <Suspense fallback={null}>
          <TurnkeyHome />
        </Suspense>
      )
    default:
      return <RainbowHome />
  }
}

function PrivyHome() {
  const { login, connectWallet } = usePrivy()

  useEffect(() => {
    if (consumeAutoConnect()) login()
  }, [login])

  return (
    <Stack>
      <button type="button" style={primaryBtn} onClick={() => connectWallet()}>
        Connect a wallet
      </button>
      <button type="button" style={secondaryBtn} onClick={() => login()}>
        Connect with Privy
      </button>
      <DepositWalletButton onConnectOwner={() => connectWallet()} />
      <TurnkeyComingSoon />
    </Stack>
  )
}

function RainbowHome() {
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <Stack>
          <button
            type="button"
            style={{ ...primaryBtn, opacity: mounted ? 1 : 0 }}
            onClick={openConnectModal}
          >
            Connect a wallet
          </button>
          <SwitchButton to="privy" label="Connect with Privy" />
          <DepositWalletButton onConnectOwner={openConnectModal} />
          <TurnkeyComingSoon />
        </Stack>
      )}
    </ConnectButton.Custom>
  )
}
