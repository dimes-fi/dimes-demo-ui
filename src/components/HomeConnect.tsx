import { lazy, Suspense, useEffect } from 'react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { usePrivy } from '@privy-io/react-auth'
import {
  walletBackend,
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

export function Stack({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 300, maxWidth: '100%' }}>
      {children}
    </div>
  )
}

/** Persist a backend choice and reload into its stack. */
const switchTo = (to: WalletBackend) => () => selectBackend(to)

export interface HomeActions {
  /** "Connect a wallet" — external wallet (or switch to a stack that has one). */
  onConnectWallet: () => void
  /** "Connect with Privy". */
  onConnectPrivy: () => void
  /** "Polymarket deposit wallet" — connect the owner of a deposit wallet. */
  onDepositWallet: () => void
  /** "Connect with Turnkey". */
  onConnectTurnkey: () => void
  /** RainbowKit's modal isn't ready on first paint; hide the primary until then. */
  primaryReady?: boolean
}

/**
 * The single source of truth for the pre-connect button layout. Every backend's
 * home renders THIS — identical buttons, order, and styling — and only swaps the
 * handlers (native action for the active backend, switch+reload for the others).
 * Order is fixed: Connect a wallet · Privy · deposit · Turnkey (Turnkey last).
 */
export function HomeButtons({
  onConnectWallet,
  onConnectPrivy,
  onDepositWallet,
  onConnectTurnkey,
  primaryReady = true,
}: HomeActions) {
  return (
    <Stack>
      <button
        type="button"
        style={{ ...primaryBtn, opacity: primaryReady ? 1 : 0 }}
        onClick={onConnectWallet}
      >
        Connect a wallet
      </button>
      <button type="button" style={secondaryBtn} onClick={onConnectPrivy}>
        Connect with Privy
      </button>
      <button
        type="button"
        style={secondaryBtn}
        onClick={onDepositWallet}
        title="Connect the wallet that owns a Polymarket deposit wallet — trades route through the push-funded flow scoped to that deposit wallet."
      >
        Polymarket deposit wallet
      </button>
      <button type="button" style={secondaryBtn} onClick={onConnectTurnkey}>
        Connect with Turnkey
      </button>
    </Stack>
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
    <HomeButtons
      onConnectWallet={() => {
        setWantsDepositWallet(false)
        connectWallet()
      }}
      onConnectPrivy={() => {
        setWantsDepositWallet(false)
        login()
      }}
      onDepositWallet={() => {
        setWantsDepositWallet(true)
        connectWallet()
      }}
      onConnectTurnkey={switchTo('turnkey')}
    />
  )
}

function RainbowHome() {
  const setWantsDepositWallet = useAuthStore((s) => s.setWantsDepositWallet)
  return (
    <ConnectButton.Custom>
      {({ openConnectModal, mounted }) => (
        <HomeButtons
          primaryReady={mounted}
          onConnectWallet={() => {
            setWantsDepositWallet(false)
            openConnectModal()
          }}
          onConnectPrivy={switchTo('privy')}
          onDepositWallet={() => {
            setWantsDepositWallet(true)
            openConnectModal()
          }}
          onConnectTurnkey={switchTo('turnkey')}
        />
      )}
    </ConnectButton.Custom>
  )
}
