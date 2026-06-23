import { useEffect, useState } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { useDepositWallet } from './useDepositWallet'

// ---------------------------------------------------------------------------
// WALLET-KIND DETECTION
//
// The vault doesn't care whether msg.sender is an EOA or a smart contract — but
// the UI has to pick the right *opening flow* for the connected wallet, and pass
// the right `wallet_address` to quotes. This hook classifies the connected
// account so TradePanel / PositionDetailDrawer can route automatically instead
// of relying on a manual toggle.
//
//   eoa              — plain EOA. Direct approve + createPosition.
//   deposit-owner    — an EOA that owns a deployed Polymarket deposit wallet.
//                      Trades route through the push-funded relayer batch, with
//                      the deposit wallet as msg.sender.
//   safe             — a smart-contract wallet exposing getOwners() (Gnosis Safe,
//                      incl. Polymarket's 1-of-1). Connected as the account; its
//                      own provider relays the vault calls, so the direct flow
//                      works with the Safe as msg.sender.
//   smart-contract   — some other contract account (Polymarket proxy, ERC-4337
//                      smart account, …). Same direct flow; the wallet relays.
// ---------------------------------------------------------------------------

export type WalletKind = 'eoa' | 'deposit-owner' | 'safe' | 'smart-contract'

const safeOwnersAbi = [
  {
    type: 'function',
    name: 'getOwners',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address[]' }],
  },
] as const

export interface WalletKindInfo {
  kind: WalletKind
  /** True while detection is still resolving (code + Safe probe + deposit lookup). */
  isLoading: boolean
  /** Deposit wallet address when kind === 'deposit-owner', else undefined. */
  depositWalletAddress: `0x${string}` | undefined
  /** Whether this kind opens positions through the push-funded relayer batch. */
  usesPushFunded: boolean
  /** Short human label for the UI badge. */
  label: string
}

const LABELS: Record<WalletKind, string> = {
  eoa: 'EOA',
  'deposit-owner': 'Polymarket Deposit Wallet',
  safe: 'Gnosis Safe',
  'smart-contract': 'Smart-contract wallet',
}

export function useWalletKind(): WalletKindInfo {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const deposit = useDepositWallet()

  // 'unknown' until the on-chain code check resolves, so callers can wait.
  const [contractKind, setContractKind] = useState<'eoa' | 'safe' | 'smart-contract' | 'unknown'>(
    'unknown',
  )

  useEffect(() => {
    if (!address || !publicClient) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset detection when wallet clears
      setContractKind('unknown')
      return
    }
    let cancelled = false

    async function classify() {
      try {
        const code = await publicClient!.getCode({ address: address! })
        if (cancelled) return
        if (!code || code === '0x') {
          setContractKind('eoa')
          return
        }
        // An EIP-7702 delegation designator (0xef0100 ++ 20-byte target) is code
        // on an otherwise-plain EOA — modern MetaMask "smart accounts" set this.
        // It's still an EOA for our purposes; don't mislabel it smart-contract.
        if (code.toLowerCase().startsWith('0xef0100')) {
          setContractKind('eoa')
          return
        }
        // Has bytecode → a contract account. A Safe answers getOwners(); others
        // revert. Either way it's the direct flow, but the label differs.
        try {
          await publicClient!.readContract({
            address: address!,
            abi: safeOwnersAbi,
            functionName: 'getOwners',
          })
          if (!cancelled) setContractKind('safe')
        } catch {
          if (!cancelled) setContractKind('smart-contract')
        }
      } catch {
        if (!cancelled) setContractKind('unknown')
      }
    }

    void classify()
    return () => {
      cancelled = true
    }
  }, [address, publicClient])

  // A deployed deposit wallet owned by this EOA takes priority — that's the one
  // case that needs the push-funded flow rather than a direct call.
  if (contractKind === 'eoa' && deposit.available && deposit.address) {
    return {
      kind: 'deposit-owner',
      isLoading: false,
      depositWalletAddress: deposit.address,
      usesPushFunded: true,
      label: LABELS['deposit-owner'],
    }
  }

  const resolved: WalletKind = contractKind === 'unknown' ? 'eoa' : contractKind
  const isLoading = contractKind === 'unknown' || (contractKind === 'eoa' && deposit.isLoading)

  return {
    kind: resolved,
    isLoading,
    depositWalletAddress: undefined,
    usesPushFunded: false,
    label: LABELS[resolved],
  }
}
