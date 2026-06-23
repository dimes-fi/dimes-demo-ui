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
import { useAuthStore } from '../store/auth'

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

/** Connect through a Polymarket deposit wallet. Records the deposit-wallet
 *  intent, then connects the owner wallet — the app scopes auth + quotes to the
 *  deposit wallet (push-funded flow). The header shows a red status if no
 *  deposit wallet is available for the connection. */
function DepositWalletButton({ onConnectOwner }: { onConnectOwner: () => void }) {
  return (
    <button
      type="button"
      style={secondaryBtn}
      onClick={onConnectOwner}
      title="Connect the wallet that owns a Polymarket deposit wallet — trades route through the push-funded flow scoped to that deposit wallet."
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
  const setWantsDepositWallet = useAuthStore((s) => s.setWantsDepositWallet)

  useEffect(() => {
    if (consumeAutoConnect()) login()
  }, [login])

  return (
    <Stack>
      <button
        type="button"
        style={primaryBtn}
        onClick={() => {
          setWantsDepositWallet(false)
          connectWallet()
        }}
      >
        Connect a wallet
      </button>
      <button
        type="button"
        style={secondaryBtn}
        onClick={() => {
          setWantsDepositWallet(false)
          login()
        }}
      >
        Connect with Privy
      </button>
      <DepositWalletButton
        onConnectOwner={() => {
          setWantsDepositWallet(true)
          connectWallet()
        }}
      />
      <TurnkeyComingSoon />
    </Stack>
  )
}

function RainbowHome() {
  const setWantsDepositWallet = useAuthStore((s) => s.setWantsDepositWallet)
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <Stack>
          <button
            type="button"
            style={{ ...primaryBtn, opacity: mounted ? 1 : 0 }}
            onClick={() => {
              setWantsDepositWallet(false)
              openConnectModal()
            }}
          >
            Connect a wallet
          </button>
          <SwitchButton to="privy" label="Connect with Privy" />
          <DepositWalletButton
            onConnectOwner={() => {
              setWantsDepositWallet(true)
              openConnectModal()
            }}
          />
          <TurnkeyComingSoon />
        </Stack>
      )}
    </ConnectButton.Custom>
  )
}
