import { useEffect, useState } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
  usePublicClient,
  useAccount,
  useChainId,
} from 'wagmi';
import { parseGwei, getAddress, type PublicClient, type TransactionReceipt } from 'viem';
import { vaultAbi, erc20Abi } from './abi';
import {
  recoverCreatePositionSigner,
  resolveExpectedSigner,
} from './verifySignature';
import { useContractInfo } from '../hooks/useContractInfo';
import { getUsdcAddress } from '../runtimeConfig';
import type { Offer } from '../api/types';

const POLYGON_AMOY_CHAIN_ID = 80002;

const AMOY_GAS_OVERRIDES = {
  gas: 500_000n,
  maxPriorityFeePerGas: parseGwei('30'),
  maxFeePerGas: parseGwei('50'),
} as const;

function useGasOverrides() {
  const chainId = useChainId();
  return chainId === POLYGON_AMOY_CHAIN_ID ? AMOY_GAS_OVERRIDES : {};
}

export const USDC_ADDRESS = getUsdcAddress();

async function diagnoseRevert(
  publicClient: PublicClient,
  receipt: TransactionReceipt,
  signatureExpirySec?: bigint,
): Promise<Error> {
  if (signatureExpirySec !== undefined) {
    try {
      const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
      if (block.timestamp > signatureExpirySec) {
        return new Error('Quote expired before the transaction was mined. Refresh and try again.');
      }
    } catch {
      // fall through to generic message
    }
  }
  return new Error('Transaction reverted on-chain.');
}

function useRevertError(
  receipt: TransactionReceipt | undefined,
  signatureExpirySec?: bigint,
): Error | null {
  const publicClient = usePublicClient();
  const [revertError, setRevertError] = useState<Error | null>(null);

  useEffect(() => {
    if (!receipt || !publicClient) {
      setRevertError(null);
      return;
    }
    if (receipt.status !== 'reverted') {
      setRevertError(null);
      return;
    }
    let cancelled = false;
    void diagnoseRevert(publicClient, receipt, signatureExpirySec).then((err) => {
      if (!cancelled) setRevertError(err);
    });
    return () => {
      cancelled = true;
    };
  }, [receipt, publicClient, signatureExpirySec]);

  return revertError;
}

export function useApproveUsdc() {
  const { writeContract, data: hash, isPending, error, reset: resetWrite } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: receiptFetched,
    error: receiptFetchError,
  } = useWaitForTransactionReceipt({ hash, pollingInterval: 2_000 });
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const gasOverrides = useGasOverrides();
  const [simulateError, setSimulateError] = useState<unknown>(null);
  const revertError = useRevertError(receipt);

  const reset = () => {
    setSimulateError(null);
    resetWrite();
  };

  const approve = async (vaultAddress: string, amount: bigint) => {
    setSimulateError(null);
    const params = {
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'approve' as const,
      args: [vaultAddress as `0x${string}`, amount] as const,
    };

    try {
      await publicClient!.simulateContract({ ...params, account });
    } catch (e) {
      setSimulateError(e);
      return;
    }

    writeContract({ ...params, ...gasOverrides });
  };

  const isSuccess = receiptFetched && receipt?.status === 'success';
  const receiptError = receiptFetchError ?? revertError;

  return { approve, hash, isPending, isConfirming, isSuccess, error, receiptError, simulateError, reset };
}

/**
 * Sandbox faucet: mints mock "Sandbox USDC" to the connected wallet. The mock
 * token's `mint(to, amount)` is unguarded, so anyone can top themselves up.
 * Only meaningful in the sandbox environment — production collateral has no
 * mint. Amount is in whole USDC (6-decimal token).
 */
const DEFAULT_MINT_USDC = 10_000n;

export function useMintSandboxUsdc() {
  const { writeContract, data: hash, isPending, error, reset: resetWrite } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: receiptFetched,
    error: receiptFetchError,
  } = useWaitForTransactionReceipt({ hash, pollingInterval: 2_000 });
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const gasOverrides = useGasOverrides();
  const [simulateError, setSimulateError] = useState<unknown>(null);
  const revertError = useRevertError(receipt);

  const reset = () => {
    setSimulateError(null);
    resetWrite();
  };

  const mint = async (amountUsdc: bigint = DEFAULT_MINT_USDC) => {
    setSimulateError(null);
    if (!account) {
      setSimulateError(new Error('Wallet not connected.'));
      return;
    }
    const params = {
      address: USDC_ADDRESS,
      abi: erc20Abi,
      functionName: 'mint' as const,
      args: [account, amountUsdc * 1_000_000n] as const,
    };

    try {
      await publicClient!.simulateContract({ ...params, account });
    } catch (e) {
      setSimulateError(e);
      return;
    }

    writeContract({ ...params, ...gasOverrides });
  };

  const isSuccess = receiptFetched && receipt?.status === 'success';
  const receiptError = receiptFetchError ?? revertError;

  return { mint, hash, isPending, isConfirming, isSuccess, error, receiptError, simulateError, reset };
}

export function useCheckAllowance(
  owner: `0x${string}` | undefined,
  vaultAddress: `0x${string}` | undefined,
) {
  const { data: allowance, refetch } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner && vaultAddress ? [owner, vaultAddress] : undefined,
    query: { enabled: !!owner && !!vaultAddress },
  });

  return { allowance: allowance as bigint | undefined, refetch };
}

export function useCreatePosition() {
  const { writeContract, data: hash, isPending, error, reset: resetWrite } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: receiptFetched,
    error: receiptFetchError,
  } = useWaitForTransactionReceipt({ hash, pollingInterval: 2_000 });
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const { data: contractInfo } = useContractInfo();
  const gasOverrides = useGasOverrides();
  const [verifyError, setVerifyError] = useState<unknown>(null);
  const [submittedExpiry, setSubmittedExpiry] = useState<bigint | undefined>(undefined);
  const revertError = useRevertError(receipt, submittedExpiry);

  const reset = () => {
    setVerifyError(null);
    setSubmittedExpiry(undefined);
    resetWrite();
  };

  const create = async (offer: Offer) => {
    setVerifyError(null);
    setSubmittedExpiry(undefined);

    if (!account) {
      setVerifyError(new Error('Wallet not connected.'));
      return;
    }

    const expectedSigner = resolveExpectedSigner(contractInfo?.polygonSignerAddress);
    if (!expectedSigner) {
      setVerifyError(new Error('Unable to verify offer: no signer address from /contract-info.'));
      return;
    }

    // The contract binds the signed `user` to `msg.sender`, so the offer must
    // have been created for the wallet that is now submitting it.
    if (getAddress(account) !== getAddress(offer.authorityPublicKey)) {
      setVerifyError(
        new Error(
          `Wrong wallet connected. This offer was created for ${getAddress(
            offer.authorityPublicKey,
          )} — connect that wallet to open the position.`,
        ),
      );
      return;
    }

    let recoveredSigner: `0x${string}`;
    try {
      recoveredSigner = await recoverCreatePositionSigner(offer);
    } catch {
      setVerifyError(new Error('Failed to recover signer from offer signature.'));
      return;
    }

    if (getAddress(recoveredSigner) !== expectedSigner) {
      setVerifyError(
        new Error(
          `Offer signature mismatch. Expected ${expectedSigner}, recovered ${getAddress(recoveredSigner)}.`,
        ),
      );
      return;
    }

    const params = {
      address: offer.polygonVaultContractAddress as `0x${string}`,
      abi: vaultAbi,
      functionName: 'createPosition' as const,
      args: [
        offer.positionSeedHex as `0x${string}`,
        offer.polymarketMarketId as `0x${string}`,
        BigInt(offer.polymarketTokenId),
        BigInt(offer.collateralUsdcUnits),
        offer.leverageBps,
        BigInt(offer.notionalUsdcUnits),
        offer.originationFeeBps,
        offer.lifetimeFeeAprBps,
        offer.liquidationFeeBps,
        BigInt(offer.expectedOpenTradingFeeUsdcUnits),
        offer.contractSignature as `0x${string}`,
        BigInt(offer.signatureExpiry),
      ] as const,
    };

    try {
      await publicClient!.simulateContract({ ...params, account });
    } catch (e) {
      setVerifyError(e);
      return;
    }

    setSubmittedExpiry(BigInt(offer.signatureExpiry));
    writeContract({ ...params, ...gasOverrides });
  };

  const isSuccess = receiptFetched && receipt?.status === 'success';
  const receiptError = receiptFetchError ?? revertError;
  const isReceiptError = receiptError != null;

  return {
    create,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    isReceiptError,
    receiptError,
    error,
    verifyError,
    reset,
  };
}

export function useRequestClose() {
  const { writeContract, data: hash, isPending, error, reset: resetWrite } = useWriteContract();
  const {
    data: receipt,
    isLoading: isConfirming,
    isSuccess: receiptFetched,
    error: receiptFetchError,
  } = useWaitForTransactionReceipt({ hash, pollingInterval: 2_000 });
  const publicClient = usePublicClient();
  const { address: account } = useAccount();
  const gasOverrides = useGasOverrides();
  const [simulateError, setSimulateError] = useState<unknown>(null);
  const revertError = useRevertError(receipt);

  const reset = () => {
    setSimulateError(null);
    resetWrite();
  };

  const requestClose = async (vaultAddress: string, positionKey: string) => {
    setSimulateError(null);
    const params = {
      address: vaultAddress as `0x${string}`,
      abi: vaultAbi,
      functionName: 'requestClose' as const,
      args: [positionKey as `0x${string}`] as const,
    };

    try {
      await publicClient!.simulateContract({ ...params, account });
    } catch (e) {
      setSimulateError(e);
      return;
    }

    writeContract({ ...params, ...gasOverrides });
  };

  const isSuccess = receiptFetched && receipt?.status === 'success';
  const receiptError = receiptFetchError ?? revertError;

  return { requestClose, hash, isPending, isConfirming, isSuccess, error, receiptError, simulateError, reset };
}
