import {
  createPublicClient,
  createWalletClient,
  http,
  hexToBigInt,
  hexToNumber,
  numberToHex,
  type Chain,
  type EIP1193Provider,
  type LocalAccount,
} from 'viem'

// ---------------------------------------------------------------------------
// TURNKEY EIP-1193 PROVIDER
//
// Turnkey ships no wagmi connector, so we bridge its signer into wagmi the
// standard way: wrap a viem LocalAccount (produced by `@turnkey/viem`
// createAccount) in an EIP-1193 provider. wagmi's custom connector
// (`turnkeyConnector`) exposes this provider, and the rest of the app's wagmi
// hooks — useWriteContract, useAccount, etc. — work unchanged.
//
// Signing/sending is delegated to a viem walletClient bound to the Turnkey
// account (it does the nonce/gas/fee fill, signs through Turnkey, and
// broadcasts the raw tx). All read-only JSON-RPC falls through to a public
// client on the same RPC.
// ---------------------------------------------------------------------------

interface RpcRequest {
  method: string
  params?: unknown[]
}

export function createTurnkeyProvider(
  account: LocalAccount,
  chain: Chain,
  rpcUrl?: string,
): EIP1193Provider {
  const transport = http(rpcUrl || undefined, { batch: true })
  const publicClient = createPublicClient({ chain, transport })
  const walletClient = createWalletClient({ account, chain, transport })

  const request = async ({ method, params = [] }: RpcRequest): Promise<unknown> => {
    switch (method) {
      case 'eth_requestAccounts':
      case 'eth_accounts':
        return [account.address]

      case 'eth_chainId':
        return numberToHex(chain.id)

      case 'wallet_switchEthereumChain': {
        const target = hexToNumber((params[0] as { chainId: `0x${string}` }).chainId)
        if (target !== chain.id) {
          throw new Error(`Turnkey wallet is pinned to chain ${chain.id} (requested ${target}).`)
        }
        return null
      }

      case 'personal_sign': {
        // EIP-1193 order: [message, address]. Sign the raw bytes as-is.
        const [data] = params as [`0x${string}`, string]
        return walletClient.signMessage({ message: { raw: data } })
      }

      case 'eth_signTypedData_v4': {
        // [address, typedDataJson]
        const [, json] = params as [string, string | object]
        const typed = typeof json === 'string' ? JSON.parse(json) : json
        return account.signTypedData(typed)
      }

      case 'eth_sendTransaction': {
        const tx = params[0] as {
          to?: `0x${string}`
          data?: `0x${string}`
          value?: `0x${string}`
          gas?: `0x${string}`
          maxFeePerGas?: `0x${string}`
          maxPriorityFeePerGas?: `0x${string}`
          nonce?: `0x${string}`
        }
        return walletClient.sendTransaction({
          account,
          chain,
          to: tx.to,
          data: tx.data,
          value: tx.value ? hexToBigInt(tx.value) : undefined,
          gas: tx.gas ? hexToBigInt(tx.gas) : undefined,
          maxFeePerGas: tx.maxFeePerGas ? hexToBigInt(tx.maxFeePerGas) : undefined,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas
            ? hexToBigInt(tx.maxPriorityFeePerGas)
            : undefined,
          nonce: tx.nonce != null ? hexToNumber(tx.nonce) : undefined,
        })
      }

      default:
        // Reads (eth_call, eth_estimateGas, eth_getTransactionReceipt, …) go
        // straight to the RPC.
        return publicClient.request({ method, params } as Parameters<typeof publicClient.request>[0])
    }
  }

  // wagmi only needs `request`; the event methods are no-ops because auth
  // changes are driven by the Turnkey bridge calling connect/disconnect.
  return {
    request,
    on: () => {},
    removeListener: () => {},
  } as unknown as EIP1193Provider
}
