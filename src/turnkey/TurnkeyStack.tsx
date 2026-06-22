import { useEffect, type ReactNode } from 'react'
import { WagmiProvider, useAccount, useConnect, useDisconnect } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TurnkeyProvider, useTurnkey, AuthState } from '@turnkey/react-wallet-kit'
import '@turnkey/react-wallet-kit/styles.css'
import { createAccount } from '@turnkey/viem'
import { polygon, polygonAmoy } from 'wagmi/chains'

import { isTestnet } from '../config'
import { turnkeyWagmiConfig } from '../config.turnkey'
import { setTurnkeyAccount, clearTurnkeyAccount } from './connector'
import {
  getTurnkeyApiBaseUrl,
  getTurnkeyAuthProxyConfigId,
  getTurnkeyOrgId,
} from '../runtimeConfig'

// ---------------------------------------------------------------------------
// TURNKEY PROVIDER STACK (lazy-loaded)
//
// Isolated in its own module and imported with React.lazy from
// WalletProviders. `@turnkey/react-wallet-kit` runs stamper setup at module
// eval that throws in a bundled web build ("…react-native-keychain…"); keeping
// it out of the eager import graph means it's only evaluated when Turnkey is
// the selected backend, so it never crashes the Privy/RainbowKit app on load.
// ---------------------------------------------------------------------------

const queryClient = new QueryClient()
const chain = isTestnet ? polygonAmoy : polygon
const rpcUrl = import.meta.env.VITE_RPC_URL as string | undefined

/** Keeps wagmi's connection in lockstep with the Turnkey session. */
function TurnkeyBridge({ children }: { children: ReactNode }) {
  const { authState, httpClient, wallets } = useTurnkey()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { isConnected } = useAccount()

  useEffect(() => {
    let cancelled = false

    async function sync() {
      if (authState === AuthState.Authenticated && httpClient && wallets?.length) {
        const ethAccount = wallets
          .flatMap((w) => w.accounts ?? [])
          .find((a) => a.addressFormat === 'ADDRESS_FORMAT_ETHEREUM')
        if (!ethAccount) return

        const account = await createAccount({
          client: httpClient,
          organizationId: ethAccount.organizationId,
          signWith: ethAccount.address,
        })
        if (cancelled) return

        setTurnkeyAccount(account, chain, rpcUrl)
        const connector = connectors.find((c) => c.id === 'turnkey')
        if (connector && !isConnected) connect({ connector })
      } else if (authState === AuthState.Unauthenticated) {
        clearTurnkeyAccount()
        if (isConnected) disconnect()
      }
    }

    void sync()
    return () => {
      cancelled = true
    }
  }, [authState, httpClient, wallets, connect, connectors, disconnect, isConnected])

  return <>{children}</>
}

export default function TurnkeyStack({ children }: { children: ReactNode }) {
  return (
    <TurnkeyProvider
      config={{
        organizationId: getTurnkeyOrgId(),
        authProxyConfigId: getTurnkeyAuthProxyConfigId(),
        apiBaseUrl: getTurnkeyApiBaseUrl(),
      }}
    >
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={turnkeyWagmiConfig}>
          <TurnkeyBridge>{children}</TurnkeyBridge>
        </WagmiProvider>
      </QueryClientProvider>
    </TurnkeyProvider>
  )
}
