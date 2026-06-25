import { useAccount } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { walletBackend } from '../runtimeConfig'
import { useAuthStore } from '../store/auth'
import { Hero } from './Hero'
import { LoadingScreen } from './LoadingScreen'

/**
 * Pre-connect screen: the landing Hero, OR the loading screen while a prior
 * session is still being restored. Backend-aware because each backend signals
 * "restoring" differently — without this the Hero (and its connect buttons)
 * flashes for a beat on every reload before the wallet rewires.
 *
 * `walletBackend()` is env-derived and constant for the page's lifetime, so the
 * switch always lands on the same branch — each leaf component calls its own
 * hooks unconditionally, keeping hook order stable.
 */
export function PreConnect() {
  switch (walletBackend()) {
    case 'privy':
      return <PrivyPreConnect />
    default:
      return <WagmiPreConnect />
  }
}

function PrivyPreConnect() {
  const { ready, authenticated } = usePrivy()
  const smartWalletAddress = useAuthStore((s) => s.smartWalletAddress)
  // Restoring until Privy has booted, and — if a session is being restored —
  // until the smart account address lands (the point isConnected flips true).
  const restoring = !ready || (authenticated && smartWalletAddress == null)
  return restoring ? <LoadingScreen message="Connecting…" /> : <Hero />
}

function WagmiPreConnect() {
  const { status } = useAccount()
  const restoring = status === 'connecting' || status === 'reconnecting'
  return restoring ? <LoadingScreen message="Connecting…" /> : <Hero />
}
