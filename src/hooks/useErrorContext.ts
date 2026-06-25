import { useEffect } from 'react'
import { useAccount, useChainId } from 'wagmi'
import { useAuthStore } from '../store/auth'
import { setErrorContextProvider } from '../utils/errorLog'

// Registers a snapshot getter so every logged error captures the live wallet /
// auth state at the moment it happened — the context that actually explains
// most wallet/chain failures. Reads from the latest render via the effect, and
// pulls auth state lazily inside the getter so it's never stale.
export function useErrorContext() {
  const { address, connector, isConnected, status } = useAccount()
  const chainId = useChainId()

  useEffect(() => {
    setErrorContextProvider(() => {
      const auth = useAuthStore.getState()
      const effective = auth.smartWalletAddress ?? auth.depositWalletAddress ?? address
      return {
        connectedWallet: address ?? null,
        effectiveWallet: effective ?? null,
        connector: connector?.name ?? null,
        isConnected,
        accountStatus: status,
        chainId,
        smartWallet: auth.smartWalletAddress,
        depositWalletMode: auth.depositWalletMode,
        depositWallet: auth.depositWalletAddress,
        authenticated: !!auth.jwt,
      }
    })
    return () => setErrorContextProvider(null)
  }, [address, connector, isConnected, status, chainId])
}
