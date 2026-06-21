import { createConfig, http } from 'wagmi'
import { polygon, polygonAmoy } from 'wagmi/chains'
import { isTestnet } from './config'
import { turnkeyConnector } from './turnkey/connector'

const chain = isTestnet ? polygonAmoy : polygon

// Same chain/transport/polling as the default config; the only connector is the
// custom Turnkey one. The Turnkey embedded wallet signs through this connector,
// so the app's contract hooks are unchanged.
export const turnkeyWagmiConfig = createConfig({
  chains: [chain],
  connectors: [turnkeyConnector()],
  pollingInterval: 30_000,
  transports: {
    [chain.id]: http(import.meta.env.VITE_RPC_URL || undefined, { batch: true }),
  } as Record<number, ReturnType<typeof http>>,
})
