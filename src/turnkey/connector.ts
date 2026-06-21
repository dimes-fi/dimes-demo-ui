import { createConnector } from 'wagmi'
import type { Chain, EIP1193Provider, LocalAccount } from 'viem'
import { createTurnkeyProvider } from './provider'

// ---------------------------------------------------------------------------
// TURNKEY WAGMI CONNECTOR
//
// A wagmi connector backed by a Turnkey embedded wallet. The signer only exists
// after the user logs in (inside React, via the react-wallet-kit hooks), but a
// wagmi connector is created at config time — so the connector reads the live
// account from a module-level holder that the Turnkey bridge populates on login
// and clears on logout (see WalletProviders.tsx).
// ---------------------------------------------------------------------------

interface Holder {
  account: LocalAccount
  chain: Chain
  provider: EIP1193Provider
}

let holder: Holder | null = null

/** Called by the Turnkey bridge once a session + Ethereum account exist. */
export function setTurnkeyAccount(account: LocalAccount, chain: Chain, rpcUrl?: string): void {
  holder = { account, chain, provider: createTurnkeyProvider(account, chain, rpcUrl) }
}

/** Called by the bridge on logout / session loss. */
export function clearTurnkeyAccount(): void {
  holder = null
}

export function hasTurnkeyAccount(): boolean {
  return holder !== null
}

export function turnkeyConnector() {
  let connected = false

  return createConnector((config) => ({
    id: 'turnkey',
    name: 'Turnkey',
    type: 'turnkey',

    // Return type is `any` on purpose: wagmi's connect() return is generic over
    // `withCapabilities`, a conditional a plain account list can't satisfy.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async connect(): Promise<any> {
      if (!holder) throw new Error('Turnkey wallet not ready — log in first.')
      connected = true
      return {
        accounts: [holder.account.address as `0x${string}`],
        chainId: holder.chain.id,
      }
    },

    async disconnect() {
      connected = false
    },

    async getAccounts() {
      return holder && connected ? [holder.account.address as `0x${string}`] : []
    },

    async getChainId() {
      return holder?.chain.id ?? config.chains[0].id
    },

    async getProvider() {
      return (holder?.provider ?? { request: async () => null }) as EIP1193Provider
    },

    async isAuthorized() {
      return connected && holder !== null
    },

    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {
      connected = false
    },
  }))
}
