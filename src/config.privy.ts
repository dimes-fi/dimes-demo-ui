import { http } from 'wagmi'
import { polygon, polygonAmoy } from 'wagmi/chains'
// Privy ships its own wagmi bindings. Use ITS createConfig (not wagmi's) so the
// Privy connector is wired in and auto-connect is handled by Privy rather than
// fighting with RainbowKit's injected connectors.
import { createConfig } from '@privy-io/wagmi'

import { isTestnet } from './config'

const chain = isTestnet ? polygonAmoy : polygon

// No `connectors` here on purpose: PrivyProvider injects the connector for the
// embedded/linked wallet. Everything else (chain, transport, polling) matches
// the default RainbowKit config so the contract hooks behave identically.
export const privyWagmiConfig = createConfig({
  chains: [chain],
  pollingInterval: 30_000,
  transports: {
    [chain.id]: http(import.meta.env.VITE_RPC_URL || undefined, {
      batch: true,
    }),
  } as Record<number, ReturnType<typeof http>>,
})
