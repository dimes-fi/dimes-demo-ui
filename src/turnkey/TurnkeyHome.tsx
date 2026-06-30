import { useEffect } from 'react'
import { useTurnkey } from '@turnkey/react-wallet-kit'
import { consumeAutoConnect, selectBackend, switchToRainbowForWallet } from '../runtimeConfig'
import { HomeButtons } from '../components/HomeConnect'

// Lazy-loaded (see HomeConnect) so @turnkey/react-wallet-kit is only evaluated
// when Turnkey is the active backend. Renders the same HomeButtons layout as the
// other backends — Turnkey login is native here; the rest switch+reload into the
// stack that owns them (the Turnkey stack has no external-wallet/deposit path).
export default function TurnkeyHome() {
  const { handleLogin } = useTurnkey()

  useEffect(() => {
    if (consumeAutoConnect()) void handleLogin()
  }, [handleLogin])

  return (
    <HomeButtons
      onConnectWallet={() => switchToRainbowForWallet(false)}
      onConnectPrivy={() => selectBackend('privy')}
      onDepositWallet={() => switchToRainbowForWallet(true)}
      onConnectTurnkey={() => void handleLogin()}
    />
  )
}
