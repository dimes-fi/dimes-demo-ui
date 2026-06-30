import { useEffect, useRef, type ReactNode } from 'react'
import { WagmiProvider, useAccount, useConnect, useDisconnect } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TurnkeyProvider, useTurnkey, AuthState } from '@turnkey/react-wallet-kit'
import '@turnkey/react-wallet-kit/styles.css'
import { createAccount } from '@turnkey/viem'
import { polygon, polygonAmoy } from 'wagmi/chains'

import { isTestnet } from '../config'
import { turnkeyWagmiConfig } from '../config.turnkey'
import { setTurnkeyAccount, clearTurnkeyAccount } from './connector'
import { useToastStore } from '../store/toasts'
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
  const tk = useTurnkey()
  const { authState, httpClient, wallets } = tk
  const { connectAsync, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { isConnected } = useAccount()
  const addToast = useToastStore((s) => s.add)

  // The SDK recreates refreshWallets/createWallet/etc. on every render. Holding
  // them in a ref (refreshed after each commit) keeps them OUT of the effect
  // deps — in deps they churned the effect, tearing it down mid-await and
  // stranding the provisioning guard, so it logged "refreshing" once then went
  // silent forever. The provisioning effect reads fns.current at call time, so
  // updating in an effect (not during render) is fine.
  const fns = useRef({ refreshWallets: tk.refreshWallets, createWallet: tk.createWallet, connectAsync, disconnect, addToast })
  useEffect(() => {
    fns.current = { refreshWallets: tk.refreshWallets, createWallet: tk.createWallet, connectAsync, disconnect, addToast }
  })

  // One-shot per mount: provision a wallet at most once (reset on error so a
  // reload/retry can try again).
  const provisionAttempted = useRef(false)

  useEffect(() => {
    let cancelled = false

    async function sync() {
      const { refreshWallets, createWallet, connectAsync, disconnect } = fns.current

      if (authState === AuthState.Authenticated && httpClient) {
        // A freshly signed-up user may have no embedded wallet yet, and the SDK
        // doesn't always hydrate `wallets` into state on its own. Fetch them; if
        // there still isn't one, create a default Ethereum wallet. Runs to
        // completion (no cancelled-bail mid-provision) so the guard can't strand;
        // populating `wallets` re-fires this effect into the connect path below.
        if (!wallets?.length) {
          if (provisionAttempted.current) return
          provisionAttempted.current = true
          console.warn('[turnkey] no wallets — refreshing')
          let list = await refreshWallets()
          if (!list?.length) {
            console.warn('[turnkey] none after refresh — creating Ethereum wallet')
            await createWallet({ walletName: 'Dimes wallet', accounts: ['ADDRESS_FORMAT_ETHEREUM'] })
            list = await refreshWallets()
          }
          console.warn('[turnkey] wallets after provision:', list?.length ?? 0)
          return
        }
        const ethAccount = wallets
          .flatMap((w) => w.accounts ?? [])
          .find((a) => a.addressFormat === 'ADDRESS_FORMAT_ETHEREUM')
        if (!ethAccount) {
          console.error('[turnkey] no ETHEREUM account on any wallet', wallets)
          return
        }

        const account = await createAccount({
          client: httpClient,
          organizationId: ethAccount.organizationId,
          signWith: ethAccount.address,
        })
        if (cancelled) return

        setTurnkeyAccount(account, chain, rpcUrl)
        const connector = connectors.find((c) => c.id === 'turnkey')
        if (!connector) {
          console.error('[turnkey] wagmi connector "turnkey" not found', connectors)
          return
        }
        // Await the connect so a failure throws here (the fire-and-forget
        // `connect()` swallows errors into mutation state — silent strand).
        if (!isConnected) await connectAsync({ connector })
      } else if (authState === AuthState.Unauthenticated) {
        clearTurnkeyAccount()
        if (isConnected) disconnect()
      }
    }

    void sync().catch((err) => {
      provisionAttempted.current = false
      console.error('[turnkey] bridge sync failed', err)
      fns.current.addToast({
        title: 'Turnkey connect failed',
        description: err instanceof Error ? err.message : String(err),
        variant: 'error',
        durationMs: 8000,
        error: err,
      })
    })
    return () => {
      cancelled = true
    }
    // fns held in a ref on purpose; SDK callbacks aren't referentially stable.
     
  }, [authState, httpClient, wallets, connectors, isConnected])

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
