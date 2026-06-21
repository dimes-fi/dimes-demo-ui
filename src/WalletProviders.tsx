import { useEffect, type ReactNode } from 'react'
import { WagmiProvider, useAccount, useConnect, useDisconnect } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { SmartWalletsProvider, useSmartWallets } from '@privy-io/react-auth/smart-wallets'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { TurnkeyProvider, useTurnkey, AuthState } from '@turnkey/react-wallet-kit'
import '@turnkey/react-wallet-kit/styles.css'
import { createAccount } from '@turnkey/viem'
import { polygon, polygonAmoy } from 'wagmi/chains'

import { config, isTestnet } from './config'
import { privyWagmiConfig } from './config.privy'
import { turnkeyWagmiConfig } from './config.turnkey'
import { setTurnkeyAccount, clearTurnkeyAccount } from './turnkey/connector'
import { setSmartWalletClient } from './contract/smartWalletClient'
import { useAuthStore } from './store/auth'
import {
  getPrivyAppId,
  getTurnkeyApiBaseUrl,
  getTurnkeyAuthProxyConfigId,
  getTurnkeyOrgId,
  walletBackend,
} from './runtimeConfig'

const queryClient = new QueryClient()

const chain = isTestnet ? polygonAmoy : polygon
const rpcUrl = import.meta.env.VITE_RPC_URL as string | undefined

/**
 * Keeps wagmi's connection in lockstep with the Turnkey session. On login it
 * derives a viem account from the user's Ethereum wallet account (via
 * `@turnkey/viem`), hands it to the connector, and connects wagmi. On logout it
 * clears the connector and disconnects. Rendered inside both TurnkeyProvider
 * (for `useTurnkey`) and WagmiProvider (for `useConnect`).
 */
function TurnkeyBridge({ children }: { children: ReactNode }) {
  const { authState, httpClient, wallets } = useTurnkey()
  const { connect, connectors } = useConnect()
  const { disconnect } = useDisconnect()
  const { isConnected } = useAccount()

  useEffect(() => {
    let cancelled = false

    async function sync() {
      if (authState === AuthState.Authenticated && httpClient && wallets?.length) {
        // First Ethereum account across the user's wallets; it carries its own
        // (sub-)organizationId, which is what `createAccount` must sign under.
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

/**
 * Publishes the Privy AA smart-account client + address so the shared
 * create/close hooks (which render outside SmartWalletsProvider under other
 * backends) can reach it. When a smart wallet is active its address becomes the
 * scoped auth wallet (the on-chain msg.sender), mirroring deposit-wallet mode.
 */
function SmartWalletBridge() {
  const { authenticated } = usePrivy()
  const { client } = useSmartWallets()
  const { isConnected } = useAccount()
  const { disconnect } = useDisconnect()
  const setSmartWalletAddress = useAuthStore((s) => s.setSmartWalletAddress)
  const clearAuth = useAuthStore((s) => s.clearAuth)

  useEffect(() => {
    if (authenticated) {
      setSmartWalletClient(client ?? null)
      setSmartWalletAddress(client?.account?.address ?? null)
      return
    }
    // Single teardown authority. Disconnect = Privy `logout()` only; it flips
    // `authenticated`, and this effect (running *after* logout settles, so it
    // can't interfere with it) drops the wagmi session + scoped auth. Doing the
    // wagmi disconnect inside the logout click instead left Privy half-logged-in
    // ("user is already logged in" on the next connect).
    setSmartWalletClient(null)
    setSmartWalletAddress(null)
    clearAuth()
    if (isConnected) disconnect()
  }, [authenticated, client, isConnected, disconnect, setSmartWalletAddress, clearAuth])

  return null
}

/**
 * Wallet/data provider stack. Three interchangeable backends behind one switch
 * (see `walletBackend()`):
 *
 * - Default: RainbowKit over the standard wagmi config.
 * - Privy (VITE_PRIVY_APP_ID): Privy embedded wallets over Privy's wagmi bindings.
 * - Turnkey (VITE_TURNKEY_ORG_ID + auth-proxy id): Turnkey embedded wallets over
 *   a custom wagmi connector.
 *
 * Either way the app below sees the same wagmi hooks (useAccount,
 * useWriteContract, usePublicClient …), so the on-chain create/close flow in
 * contract/hooks.ts is untouched.
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  const backend = walletBackend()

  if (backend === 'turnkey') {
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

  if (backend === 'privy') {
    return (
      <PrivyProvider
        appId={getPrivyAppId()}
        config={{
          defaultChain: chain,
          supportedChains: [chain],
          embeddedWallets: { ethereum: { createOnLogin: 'users-without-wallets' } },
          appearance: { theme: 'dark', accentColor: '#EEFF00' },
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyWagmiConfig}>
            <SmartWalletsProvider>
              <SmartWalletBridge />
              {children}
            </SmartWalletsProvider>
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    )
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({ accentColor: '#EEFF00', accentColorForeground: '#0C0C0C' })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
