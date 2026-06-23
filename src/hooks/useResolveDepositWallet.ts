import { useEffect } from 'react';
import { useAuthStore } from '../store/auth';
import { useDepositWallet } from '../contract/useDepositWallet';

/**
 * Resolve the user's deposit-wallet *intent* into the active `depositWalletMode`.
 *
 * Intent is explicit — set by the home-page buttons and the header toggle — so
 * we never silently switch a plain EOA connection into deposit mode just because
 * a deposit wallet happens to exist. When the user asks for the deposit wallet
 * we scope to its deterministic (CREATE2) address even if it isn't deployed yet;
 * the header surfaces a red "no deposit wallet" status in that case.
 */
export function useResolveDepositWallet() {
  const wantsDepositWallet = useAuthStore((s) => s.wantsDepositWallet);
  const setDepositWalletMode = useAuthStore((s) => s.setDepositWalletMode);
  const { address: depositAddress } = useDepositWallet();

  useEffect(() => {
    if (wantsDepositWallet && depositAddress) {
      setDepositWalletMode(true, depositAddress);
    } else {
      setDepositWalletMode(false, null);
    }
  }, [wantsDepositWallet, depositAddress, setDepositWalletMode]);
}
