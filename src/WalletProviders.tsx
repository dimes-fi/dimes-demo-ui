import type { ReactNode } from 'react'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { polygon, polygonAmoy } from 'wagmi/chains'

import { config, isTestnet } from './config'
import { privyWagmiConfig } from './config.privy'
import { getPrivyAppId, isPrivyMode } from './runtimeConfig'

const queryClient = new QueryClient()

const chain = isTestnet ? polygonAmoy : polygon

/**
 * Wallet/data provider stack. Two interchangeable backends behind one switch:
 *
 * - Default: RainbowKit over the standard wagmi config.
 * - Privy (when VITE_PRIVY_APP_ID is set): Privy embedded wallets over Privy's
 *   wagmi bindings.
 *
 * Either way the app below sees the same wagmi hooks (useAccount,
 * useWriteContract, usePublicClient …), so the on-chain create/close flow in
 * contract/hooks.ts is untouched.
 */
export function WalletProviders({ children }: { children: ReactNode }) {
  if (isPrivyMode()) {
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
          <PrivyWagmiProvider config={privyWagmiConfig}>{children}</PrivyWagmiProvider>
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
