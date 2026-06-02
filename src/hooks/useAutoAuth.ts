import { useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { useAuthStore } from '../store/auth';
import { DEMO_WALLET_ADDRESS, isDemoMode, requestAuthToken } from '../api/auth';
import { useDisplayWallet } from './useDisplayWallet';

const REFRESH_BUFFER_MS = 60_000;

/**
 * Keep a valid JWT in the auth store.
 *
 * In demo mode the token is scoped to the hardcoded demo wallet and is
 * minted on mount so the market list is visible before wallet connect.
 * In real mode the token tracks the connected wallet and is only minted
 * once a wallet is present. Refreshes 60s before expiry in both cases.
 */
export function useAutoAuth() {
  const { address, isConnected } = useAccount();
  const { setAuth, clearAuth } = useAuthStore();
  const depositWalletMode = useAuthStore((s) => s.depositWalletMode);
  const depositWalletAddress = useAuthStore((s) => s.depositWalletAddress);
  const displayWallet = useDisplayWallet();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    // In deposit-wallet mode the JWT and quotes must be scoped to the deposit
    // wallet contract (the on-chain `msg.sender`), not the connected owner EOA.
    const connectedAddress = isConnected && address ? address : undefined;
    // Demo-only override: when a display wallet is set, mint the JWT for it so
    // positions/quotes/socket all follow it. Takes precedence over everything.
    // NOTE: in pure demo-token mode the sandbox endpoint is hardcoded to the
    // demo wallet and ignores this — it only takes effect on the /tokens path.
    const effectiveAddress = displayWallet
      ? displayWallet
      : isDemoMode
        ? DEMO_WALLET_ADDRESS
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
        });
    }

    if (effectiveAddress) {
      fetchToken();
    } else {
      clearTimer();
      clearAuth();
    }

    return clearTimer;
  }, [isConnected, address, depositWalletMode, depositWalletAddress, displayWallet, setAuth, clearAuth]);
}
