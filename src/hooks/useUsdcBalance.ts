import { useReadContracts } from 'wagmi'
import { erc20Abi } from '../contract/abi'
import { USDC_ADDRESS } from '../contract/hooks'

export interface UsdcBalance {
  value: bigint
  decimals: number
  symbol: string
}

/**
 * Collateral-token balance for a wallet.
 *
 * wagmi's `useBalance` dropped its `token` option in v3, so the ERC-20 balance is read
 * directly. Every caller shows the same number in a different place, so they all read it
 * through here and can never disagree.
 */
export function useUsdcBalance(address: `0x${string}` | undefined): { data: UsdcBalance | undefined } {
  const enabled = !!address && !!USDC_ADDRESS

  const { data } = useReadContracts({
    contracts: [
      {
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      },
      {
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      },
      {
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      },
    ],
    query: { enabled },
  })

  const value = data?.[0]?.status === 'success' ? (data[0].result as bigint) : undefined
  const decimals = data?.[1]?.status === 'success' ? Number(data[1].result) : undefined
  const symbol = data?.[2]?.status === 'success' ? (data[2].result as string) : undefined

  if (value === undefined || decimals === undefined || symbol === undefined) return { data: undefined }

  return { data: { value, decimals, symbol } }
}
