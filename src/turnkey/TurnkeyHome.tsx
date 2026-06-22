import { useEffect } from 'react'
import { useTurnkey } from '@turnkey/react-wallet-kit'
import { consumeAutoConnect } from '../runtimeConfig'
import { Stack, SwitchButton } from '../components/HomeConnect'
import { primaryBtn } from '../components/connectShared'

// Lazy-loaded (see HomeConnect) so @turnkey/react-wallet-kit is only evaluated
// when Turnkey is the active backend.
export default function TurnkeyHome() {
  const { handleLogin } = useTurnkey()

  useEffect(() => {
    if (consumeAutoConnect()) void handleLogin()
  }, [handleLogin])

  return (
    <Stack>
      <button type="button" style={primaryBtn} onClick={() => void handleLogin()}>
        Connect with Turnkey
      </button>
      <SwitchButton to="privy" label="Connect with Privy" />
    </Stack>
  )
}
