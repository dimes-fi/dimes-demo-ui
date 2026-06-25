import { useTurnkey, AuthState } from '@turnkey/react-wallet-kit'
import { useAccount } from 'wagmi'
import { isTestnet } from '../config'
import { useDisplayWallet } from '../hooks/useDisplayWallet'
import { AccountMenuShell } from '../components/ConnectControls'
import { btnStyle, shorten, type MenuAction } from '../components/connectShared'

// Lazy-loaded (see ConnectControls) so @turnkey/react-wallet-kit is only
// evaluated when Turnkey is the active backend.

interface TurnkeyLogout {
  logout?: () => Promise<void>
}

export default function TurnkeyControls({ compact }: { compact: boolean }) {
  const tk = useTurnkey()
  const { authState, handleLogin, wallets } = tk
  const { address } = useAccount()
  const displayWallet = useDisplayWallet()
  const base = btnStyle(compact)

  const connected = authState === AuthState.Authenticated && !!address

  if (!connected) {
    return (
      <div style={{ display: 'inline-flex', gap: 8 }}>
        <button
          type="button"
          onClick={() => void handleLogin()}
          style={{
            ...base,
            background: 'var(--yellow)',
            color: 'var(--yellow-ink)',
            borderColor: 'var(--yellow)',
            fontWeight: 700,
          }}
        >
          Connect wallet
        </button>
      </div>
    )
  }

  const walletId = wallets?.[0]?.walletId
  const logout = (tk as unknown as TurnkeyLogout).logout
  const actions: MenuAction[] = [
    ...(walletId
      ? [{ label: 'Export wallet key', onClick: () => void tk.handleExportWallet({ walletId }) }]
      : []),
    { label: 'Disconnect', onClick: () => void logout?.(), danger: true },
  ]

  return (
    <div style={{ display: 'inline-flex', gap: 8 }}>
      {isTestnet && (
        <button type="button" style={{ ...base, cursor: 'default' }} disabled>
          Amoy
        </button>
      )}
      <AccountMenuShell
        address={address!}
        label={shorten(displayWallet ?? address!)}
        base={base}
        actions={actions}
      />
    </div>
  )
}
