import { useCallback, useState } from 'react'
import { encodeFunctionData, getAddress } from 'viem'
import { usePublicClient } from 'wagmi'
import {
  assertQuoteSigner,
  buildApproveTx,
  buildCreatePositionTx,
  buildRequestCloseTx,
  buildRequestPartialCloseTx,
  resolveExpectedSigner,
} from '@dimes-dot-fi/sdk/contract'
import { getUsdcAddress } from '../runtimeConfig'
import { useContractInfo } from '../hooks/useContractInfo'
import { getSmartWalletClient } from './smartWalletClient'
import type { Offer } from '../api/types'

// ---------------------------------------------------------------------------
// PRIVY SMART-WALLET (ERC-4337 / AA) FLOW
//
// The smart account is msg.sender. Because 4337 accounts batch calls, opening a
// position is a single userOperation that bundles `approve` + `createPosition`
// — no separate approval step, and gasless when the Privy app has a paymaster
// configured. Closing is a single `requestClose` userOp.
//
// Return shapes mirror the EOA hooks (useCreatePosition / useRequestClose) so
// TradePanel / PositionDetailDrawer can route to either uniformly.
// ---------------------------------------------------------------------------

const USDC_ADDRESS = getUsdcAddress()

interface Call {
  to: `0x${string}`
  data: `0x${string}`
  value: bigint
}

export function useCreatePositionSmart() {
  const publicClient = usePublicClient()
  const { data: contractInfo } = useContractInfo()
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [receiptError, setReceiptError] = useState<Error | null>(null)
  const [verifyError, setVerifyError] = useState<Error | null>(null)

  const reset = useCallback(() => {
    setHash(null)
    setIsPending(false)
    setIsConfirming(false)
    setIsSuccess(false)
    setError(null)
    setReceiptError(null)
    setVerifyError(null)
  }, [])

  const create = useCallback(
    async (offer: Offer) => {
      reset()
      const client = getSmartWalletClient()
      if (!client) {
        setVerifyError(new Error('Smart wallet not ready.'))
        return
      }

      // The smart account is msg.sender; the contract binds the signed `user` to
      // it, so verify the offer signature against the API's authorized signer
      // before submitting — fail fast instead of reverting on-chain.
      const expectedSigner = resolveExpectedSigner(contractInfo?.polygonSignerAddress)
      if (!expectedSigner) {
        setVerifyError(new Error('Unable to verify offer: no signer address from /contract-info.'))
        return
      }
      try {
        await assertQuoteSigner(offer, getAddress(offer.authorityPublicKey), expectedSigner)
      } catch (e) {
        setVerifyError(e instanceof Error ? e : new Error('Failed to verify offer signature.'))
        return
      }

      const vault = offer.polygonVaultContractAddress as `0x${string}`
      const approve = buildApproveTx(USDC_ADDRESS, vault, BigInt(offer.totalUserAmountUsdcUnits))
      const createPosition = buildCreatePositionTx(offer)

      // One userOp: approve the vault, then createPosition.
      const calls: Call[] = [
        { to: approve.address, data: encodeFunctionData(approve), value: 0n },
        { to: createPosition.address, data: encodeFunctionData(createPosition), value: 0n },
      ]

      setIsPending(true)
      let txHash: `0x${string}`
      try {
        txHash = await client.sendTransaction({ account: client.account, calls })
      } catch (e) {
        setError(e as Error)
        setIsPending(false)
        return
      }
      setHash(txHash)
      setIsPending(false)
      setIsConfirming(true)
      try {
        const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status === 'success') setIsSuccess(true)
        else setReceiptError(new Error('Transaction reverted on-chain.'))
      } catch (e) {
        setReceiptError(e as Error)
      } finally {
        setIsConfirming(false)
      }
    },
    [publicClient, contractInfo, reset],
  )

  return {
    create,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    isReceiptError: receiptError != null,
    receiptError,
    error,
    verifyError,
    reset,
  }
}

export function useRequestCloseSmart() {
  const publicClient = usePublicClient()
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [receiptError, setReceiptError] = useState<Error | null>(null)
  const [verifyError, setVerifyError] = useState<Error | null>(null)

  const reset = useCallback(() => {
    setHash(null)
    setIsPending(false)
    setIsConfirming(false)
    setIsSuccess(false)
    setError(null)
    setReceiptError(null)
    setVerifyError(null)
  }, [])

  const requestClose = useCallback(
    async (vaultAddress: string, positionKey: string) => {
      reset()
      const client = getSmartWalletClient()
      if (!client) {
        setVerifyError(new Error('Smart wallet not ready.'))
        return
      }

      const closeTx = buildRequestCloseTx(vaultAddress as `0x${string}`, positionKey as `0x${string}`)
      const calls: Call[] = [{ to: closeTx.address, data: encodeFunctionData(closeTx), value: 0n }]

      setIsPending(true)
      let txHash: `0x${string}`
      try {
        txHash = await client.sendTransaction({ account: client.account, calls })
      } catch (e) {
        setError(e as Error)
        setIsPending(false)
        return
      }
      setHash(txHash)
      setIsPending(false)
      setIsConfirming(true)
      try {
        const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status === 'success') setIsSuccess(true)
        else setReceiptError(new Error('Transaction reverted on-chain.'))
      } catch (e) {
        setReceiptError(e as Error)
      } finally {
        setIsConfirming(false)
      }
    },
    [publicClient, reset],
  )

  return {
    requestClose,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receiptError,
    error,
    verifyError,
    reset,
  }
}

export function useRequestPartialCloseSmart() {
  const publicClient = usePublicClient()
  const [hash, setHash] = useState<`0x${string}` | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [receiptError, setReceiptError] = useState<Error | null>(null)
  const [verifyError, setVerifyError] = useState<Error | null>(null)

  const reset = useCallback(() => {
    setHash(null)
    setIsPending(false)
    setIsConfirming(false)
    setIsSuccess(false)
    setError(null)
    setReceiptError(null)
    setVerifyError(null)
  }, [])

  const requestPartialClose = useCallback(
    async (vaultAddress: string, positionKey: string, closeTokenUnits: bigint) => {
      reset()
      const client = getSmartWalletClient()
      if (!client) {
        setVerifyError(new Error('Smart wallet not ready.'))
        return
      }

      const partialCloseTx = buildRequestPartialCloseTx(
        vaultAddress as `0x${string}`,
        positionKey as `0x${string}`,
        closeTokenUnits,
      )
      const calls: Call[] = [{ to: partialCloseTx.address, data: encodeFunctionData(partialCloseTx), value: 0n }]

      setIsPending(true)
      let txHash: `0x${string}`
      try {
        txHash = await client.sendTransaction({ account: client.account, calls })
      } catch (e) {
        setError(e as Error)
        setIsPending(false)
        return
      }
      setHash(txHash)
      setIsPending(false)
      setIsConfirming(true)
      try {
        const receipt = await publicClient!.waitForTransactionReceipt({ hash: txHash })
        if (receipt.status === 'success') setIsSuccess(true)
        else setReceiptError(new Error('Transaction reverted on-chain.'))
      } catch (e) {
        setReceiptError(e as Error)
      } finally {
        setIsConfirming(false)
      }
    },
    [publicClient, reset],
  )

  return {
    requestPartialClose,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    receiptError,
    error,
    verifyError,
    reset,
  }
}
