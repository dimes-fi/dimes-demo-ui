import { create } from 'zustand';

interface AuthState {
  jwt: string | null;
  walletAddress: string | null;
  expiresAt: string | null;
  /**
   * User intent picked on the home page (or toggled from the header badge):
   * `true` = trade as the Polymarket deposit wallet, `false` = trade as the
   * connected EOA. Drives `depositWalletMode`; auto-detection no longer flips it.
   */
  wantsDepositWallet: boolean;
  /** When true, auth + quotes are scoped to `depositWalletAddress` instead of the connected wallet. */
  depositWalletMode: boolean;
  /** The Polymarket deposit wallet contract address, when deposit-wallet mode is on. */
  depositWalletAddress: string | null;
  /**
   * Privy AA (ERC-4337) smart account address, when a smart wallet is active.
   * Like deposit-wallet mode this becomes the on-chain `msg.sender`, so auth +
   * quotes must be scoped to it; positions are opened/closed through the
   * smart-wallet client.
   */
  smartWalletAddress: string | null;
  setAuth: (jwt: string, walletAddress: string, expiresAt: string) => void;
  clearAuth: () => void;
  setWantsDepositWallet: (wantsDepositWallet: boolean) => void;
  setDepositWalletMode: (enabled: boolean, depositWalletAddress: string | null) => void;
  setSmartWalletAddress: (address: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  jwt: null,
  walletAddress: null,
  expiresAt: null,
  wantsDepositWallet: false,
  depositWalletMode: false,
  depositWalletAddress: null,
  smartWalletAddress: null,
  setAuth: (jwt, walletAddress, expiresAt) => set({ jwt, walletAddress, expiresAt }),
  clearAuth: () =>
    set({
      jwt: null,
      walletAddress: null,
      expiresAt: null,
      wantsDepositWallet: false,
      depositWalletMode: false,
      depositWalletAddress: null,
      smartWalletAddress: null,
    }),
  setWantsDepositWallet: (wantsDepositWallet) => set({ wantsDepositWallet }),
  setDepositWalletMode: (depositWalletMode, depositWalletAddress) => set({ depositWalletMode, depositWalletAddress }),
  setSmartWalletAddress: (smartWalletAddress) => set({ smartWalletAddress }),
}));
