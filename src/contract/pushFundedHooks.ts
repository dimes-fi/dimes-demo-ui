import { useState } from 'react';
import { getAddress } from 'viem';
import { useAccount, usePublicClient, useSignTypedData } from 'wagmi';
import {
  buildDepositWalletBatch,
  buildPushFundedCreateCalls,
  buildRequestCloseCalls,
  buildRequestPartialCloseCalls,
  getDepositWalletBatchTypedData,
  type DepositWalletCall,
} from '@dimes-dot-fi/sdk/contract';
import { submitRelayerBatch, submitRelayerBatchDirect } from '../api/relayer';
import { useContractInfo } from '../hooks/useContractInfo';
import { useAuthStore } from '../store/auth';
import { getBuilderCreds, hasBuilderCreds } from '../store/builderCreds';
import type { Offer } from '../api/types';
import { USDC_ADDRESS } from './hooks';
import { assertQuoteSigner, resolveExpectedSigner } from '@dimes-dot-fi/sdk/contract';

// The deposit-wallet batch must be submitted before this deadline (unix seconds).
const BATCH_DEADLINE_WINDOW_SECONDS = 600n;

const depositWalletNonceAbi = [
  {
    type: 'function',
    name: 'nonce',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

interface PushFundedState {
  /** Waiting on the wallet to sign the batch. */
  isPending: boolean;
  /** Batch signed and submitted — waiting for the relayer to mine it. */
  isConfirming: boolean;
  isSuccess: boolean;
  /** Pre-flight failure (no deposit wallet, signature mismatch). */
  verifyError: Error | null;
  /** Wallet rejected or failed to sign. */
  error: Error | null;
  /** Relayer submission or on-chain failure. */
  receiptError: Error | null;
  transactionHash: string | null;
}

const initialState: PushFundedState = {
  isPending: false,
  isConfirming: false,
  isSuccess: false,
  verifyError: null,
  error: null,
  receiptError: null,
  transactionHash: null,
};

function toRelayerCalls(calls: DepositWalletCall[]) {
  return calls.map((call) => ({
    target: call.target,
    value: call.value.toString(),
    data: call.data,
  }));
}

function toError(value: unknown, fallback: string): Error {
  return value instanceof Error ? value : new Error(fallback);
}

/**
 * Shared runner for the deposit-wallet push-funded flow: read the wallet nonce,
 * assemble + sign the EIP-712 batch with the connected owner wallet, then send
 * the signed batch to the backend relayer endpoint.
 */
function usePushFundedBatch() {
  const [state, setState] = useState<PushFundedState>(initialState);
  const { address: ownerAddress } = useAccount();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const depositWalletAddress = useAuthStore((s) => s.depositWalletAddress);

  const reset = () => setState(initialState);

  const run = async (buildCalls: () => DepositWalletCall[]): Promise<void> => {
    setState(initialState);

    if (!depositWalletAddress) {
      setState({ ...initialState, verifyError: new Error('Deposit-wallet mode is not enabled.') });
      return;
    }
    if (!ownerAddress) {
      setState({ ...initialState, verifyError: new Error('Wallet not connected.') });
      return;
    }
    if (!publicClient) {
      setState({ ...initialState, verifyError: new Error('No RPC client available.') });
      return;
    }

    const depositWallet = depositWalletAddress as `0x${string}`;

    let calls: DepositWalletCall[];
    let nonce: bigint;
    try {
      calls = buildCalls();
      nonce = await publicClient.readContract({
        address: depositWallet,
        abi: depositWalletNonceAbi,
        functionName: 'nonce',
      });
    } catch (e) {
      setState({ ...initialState, verifyError: toError(e, 'Failed to prepare the deposit-wallet batch.') });
      return;
    }

    const deadline = BigInt(Math.floor(Date.now() / 1000)) + BATCH_DEADLINE_WINDOW_SECONDS;
    const batch = buildDepositWalletBatch({ depositWalletAddress: depositWallet, nonce, deadline, calls });

    setState({ ...initialState, isPending: true });

    let signature: `0x${string}`;
    try {
      const typedData = getDepositWalletBatchTypedData(batch);
      signature = await signTypedDataAsync({
        domain: typedData.domain,
        types: typedData.types,
        primaryType: typedData.primaryType,
        message: typedData.message,
      });
    } catch (e) {
      setState({ ...initialState, error: toError(e, 'Failed to sign the batch.') });
      return;
    }

    setState({ ...initialState, isConfirming: true });

    const relayerParams = {
      depositWalletAddress: depositWallet,
      ownerAddress,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      calls: toRelayerCalls(calls),
      signature,
    };

    // Local-demo path: when Polymarket builder credentials are configured via
    // env (VITE_BUILDER_API_*), submit straight to the relayer from the browser
    // instead of routing through the partner-API-key-guarded backend endpoint.
    try {
      const result = hasBuilderCreds
        ? await submitRelayerBatchDirect(relayerParams, getBuilderCreds())
        : await submitRelayerBatch(relayerParams);
      setState({ ...initialState, isSuccess: true, transactionHash: result.transactionHash });
    } catch (e) {
      setState({ ...initialState, receiptError: toError(e, 'Relayer submission failed.') });
    }
  };

  return { state, reset, run };
}

/**
 * Open a position from a Polymarket deposit wallet via the push-funded 3-call
 * batch (reserveDeposit + USDC.transfer + createPositionPushFunded).
 */
export function useCreatePositionPushFunded() {
  const { state, reset, run } = usePushFundedBatch();
  const { address: ownerAddress } = useAccount();
  const { data: contractInfo } = useContractInfo();
  const depositWalletAddress = useAuthStore((s) => s.depositWalletAddress);
  const [verifyError, setVerifyError] = useState<Error | null>(null);

  const create = async (offer: Offer): Promise<void> => {
    setVerifyError(null);

    if (!ownerAddress || !depositWalletAddress) {
      setVerifyError(new Error('Connect a wallet and enable deposit-wallet mode first.'));
      return;
    }

    // The offer signature binds to the deposit wallet (the on-chain msg.sender),
    // so the offer must have been created for this deposit wallet.
    if (getAddress(offer.authorityPublicKey) !== getAddress(depositWalletAddress as `0x${string}`)) {
      setVerifyError(
        new Error(
          `Offer was created for ${getAddress(
            offer.authorityPublicKey,
          )}, not the active deposit wallet ${getAddress(depositWalletAddress as `0x${string}`)}.`,
        ),
      );
      return;
    }

    const expectedSigner = resolveExpectedSigner(contractInfo?.polygonSignerAddress);
    if (!expectedSigner) {
      setVerifyError(new Error('Unable to verify offer: no signer address from /contract-info.'));
      return;
    }
    try {
      await assertQuoteSigner(offer, getAddress(offer.authorityPublicKey), expectedSigner);
    } catch (e) {
      setVerifyError(e instanceof Error ? e : new Error('Failed to verify offer signature.'));
      return;
    }

    await run(() => buildPushFundedCreateCalls(offer, USDC_ADDRESS));
  };

  return {
    create,
    isPending: state.isPending,
    isConfirming: state.isConfirming,
    isSuccess: state.isSuccess,
    transactionHash: state.transactionHash,
    verifyError: verifyError ?? state.verifyError,
    error: state.error,
    receiptError: state.receiptError,
    reset: () => {
      setVerifyError(null);
      reset();
    },
  };
}

/**
 * Close a position from a Polymarket deposit wallet — a single-call
 * `requestClose` wrapped in the same deposit-wallet batch.
 */
export function useRequestClosePushFunded() {
  const { state, reset, run } = usePushFundedBatch();

  const requestClose = async (vaultAddress: string, positionKey: string): Promise<void> => {
    await run(() => buildRequestCloseCalls(vaultAddress, positionKey));
  };

  return {
    requestClose,
    isPending: state.isPending,
    isConfirming: state.isConfirming,
    isSuccess: state.isSuccess,
    transactionHash: state.transactionHash,
    verifyError: state.verifyError,
    error: state.error,
    receiptError: state.receiptError,
    reset,
  };
}

/**
 * Partial-close a position from a Polymarket deposit wallet — a single-call
 * `requestPartialClose` wrapped in the same deposit-wallet batch.
 */
export function useRequestPartialClosePushFunded() {
  const { state, reset, run } = usePushFundedBatch();

  const requestPartialClose = async (
    vaultAddress: string,
    positionKey: string,
    closeTokenUnits: bigint,
  ): Promise<void> => {
    await run(() => buildRequestPartialCloseCalls(vaultAddress, positionKey, closeTokenUnits));
  };

  return {
    requestPartialClose,
    isPending: state.isPending,
    isConfirming: state.isConfirming,
    isSuccess: state.isSuccess,
    transactionHash: state.transactionHash,
    verifyError: state.verifyError,
    error: state.error,
    receiptError: state.receiptError,
    reset,
  };
}
