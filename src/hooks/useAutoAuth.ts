import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useAuthStore } from '../store/auth';
import { requestAuthToken } from '../api/auth';
import { ApiError } from '../api/client';
import { useToastStore } from '../store/toasts';
import { useDisplayWallet } from './useDisplayWallet';

const REFRESH_BUFFER_MS = 60_000;

/**
 * Keep a valid JWT in the auth store. The token tracks the connected wallet
 * and is only minted once a wallet is present. Refreshes 60s before expiry.
 */
export function useAutoAuth() {
  const { address, isConnected } = useAccount();
  const { setAuth, clearAuth } = useAuthStore();
  const depositWalletMode = useAuthStore((s) => s.depositWalletMode);
  const depositWalletAddress = useAuthStore((s) => s.depositWalletAddress);
  const smartWalletAddress = useAuthStore((s) => s.smartWalletAddress);
  const displayWallet = useDisplayWallet();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // For a smart wallet (AA) or a deposit wallet, the JWT and quotes must be
    // scoped to that contract — the on-chain `msg.sender` — not the connected
    // signer/owner EOA.
    const connectedAddress = isConnected && address ? address : undefined;
    // Precedence: display-wallet override > smart account > deposit wallet >
    // connected wallet.
    const effectiveAddress = displayWallet
      ? displayWallet
      : smartWalletAddress
        ? smartWalletAddress
        : depositWalletMode && depositWalletAddress
          ? depositWalletAddress
          : connectedAddress;

    function clearTimer() {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = undefined;
      }
    }

    function scheduleRefresh(expiresAt: string) {
      clearTimer();
      const msUntilExpiry = new Date(expiresAt).getTime() - Date.now();
      const refreshIn = Math.max(msUntilExpiry - REFRESH_BUFFER_MS, 0);
      refreshTimer.current = setTimeout(fetchToken, refreshIn);
    }

    function fetchToken() {
      if (!effectiveAddress) return;
      requestAuthToken(effectiveAddress)
        .then((result) => {
          setAuth(result.token, effectiveAddress, result.expiresAt);
          scheduleRefresh(result.expiresAt);
        })
        .catch((err) => {
          console.error('[auth] failed to mint token', err);
          if (err instanceof ApiError && err.status === 401) {
            useToastStore.getState().add({
              title: 'API key rejected',
              description: 'The token request returned 401. Check your API key and environment in Settings.',
              variant: 'error',
              durationMs: 8000,
            });
          }
        });
    }

    if (effectiveAddress) {
      fetchToken();
    } else {
      clearTimer();
      clearAuth();
    }

    return clearTimer;
  }, [
    isConnected,
    address,
    depositWalletMode,
    depositWalletAddress,
    smartWalletAddress,
    displayWallet,
    setAuth,
    clearAuth,
  ]);
}
