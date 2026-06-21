import type { SmartWalletClientType } from '@privy-io/react-auth/smart-wallets'

// ---------------------------------------------------------------------------
// SMART-WALLET CLIENT HOLDER
//
// `useSmartWallets()` only works inside Privy's SmartWalletsProvider, but the
// create/close hooks are called from shared components (TradePanel,
// PositionDetailDrawer) that also render under RainbowKit/Turnkey — where that
// provider isn't mounted. So a Privy-only bridge writes the live smart-account
// client here, and the hooks read it lazily at call time. Null whenever no
// Privy AA wallet is active.
// ---------------------------------------------------------------------------

let client: SmartWalletClientType | null = null

export function setSmartWalletClient(next: SmartWalletClientType | null): void {
  client = next
}

export function getSmartWalletClient(): SmartWalletClientType | null {
  return client
}
