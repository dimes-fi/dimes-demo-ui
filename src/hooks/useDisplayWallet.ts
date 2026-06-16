import { useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// DEMO-ONLY DISPLAY WALLET OVERRIDE
//
// Cosmetic only. Lets a presenter show an arbitrary wallet address in the
// header instead of the connected/demo wallet, so a demo can look like it's
// running as any account. Does NOT change auth, balances, quotes, or
// positions — every read/write is still scoped to the real demo wallet.
//
// Set via the subtle dot button in the header, or from the console:
//   localStorage.setItem('dimes:displayWallet', '0x…'); window.dispatchEvent(new Event('dimes:displayWallet'))
// ---------------------------------------------------------------------------

const KEY = 'dimes:displayWallet';
const EVENT = 'dimes:displayWallet';

function getSnapshot(): string | null {
  return localStorage.getItem(KEY);
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function setDisplayWallet(address: string | null) {
  if (address && address.trim()) {
    localStorage.setItem(KEY, address.trim());
  } else {
    localStorage.removeItem(KEY);
  }
  window.dispatchEvent(new Event(EVENT));
}

/** The display-only wallet override, or null when unset. */
export function useDisplayWallet(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
