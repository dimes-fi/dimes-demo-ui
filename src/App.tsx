import { useState, useCallback, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useAutoAuth } from './hooks/useAutoAuth'
import { useErrorContext } from './hooks/useErrorContext'
import { useResolveDepositWallet } from './hooks/useResolveDepositWallet'
import { usePositionSocket } from './hooks/usePositionSocket'
import { useMarketSocket } from './hooks/useMarketSocket'
import { useSeedLiveMarkets } from './hooks/useSeedLiveMarkets'
import { useAuthStore } from './store/auth'
import type { Market } from './api/types'
import { Layout } from './components/Layout'
import { ToastContainer } from './components/ToastContainer'
import { DebugPanel } from './components/DebugPanel'
import { installGlobalErrorCapture } from './utils/errorLog'

installGlobalErrorCapture()
import { Header } from './components/Header'
import { PreConnect } from './components/PreConnect'
import { LoadingScreen } from './components/LoadingScreen'
import { ApiKeyGate } from './components/ApiKeyGate'
import { getApiKey } from './runtimeConfig'
import { MarketList } from './components/MarketList'
import { TradePanel } from './components/TradePanel'
import { PositionList } from './components/PositionList'

const sectionTitle: React.CSSProperties = {
  fontSize: 'var(--fs-md)',
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 4,
}

function MarketsTitle({ count }: { count?: number }) {
  return (
    <h2 style={sectionTitle}>
      Live Supported Markets
      {count != null && (
        <>
          <span style={{ color: 'var(--text-dim)', margin: '0 8px' }}>·</span>
          <span style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
            {count}
          </span>
        </>
      )}
    </h2>
  )
}

function App() {
  const { isConnected: wagmiConnected } = useAccount()
  useErrorContext()
  useResolveDepositWallet()
  useAutoAuth()
  usePositionSocket()
  useMarketSocket()
  useSeedLiveMarkets()
  const jwt = useAuthStore((s) => s.jwt)
  const smartWalletAddress = useAuthStore((s) => s.smartWalletAddress)
  // A Privy AA smart wallet counts as connected even when the owner EOA isn't
  // wired into wagmi — otherwise the header/hero gate on wagmi alone, so the
  // pre-connect Hero stays up while markets (gated on the JWT) render below.
  const isConnected = wagmiConnected || smartWalletAddress != null
  const hasApiKey = Boolean(getApiKey())
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [marketCount, setMarketCount] = useState<number | undefined>(undefined)
  const onTotalCount = useCallback((n: number | undefined) => setMarketCount(n), [])

  const drawerOpen = selectedMarket !== null

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  return (
    <Layout>
      <ToastContainer />
      <DebugPanel />
      {hasApiKey && isConnected && <Header />}

      <main style={{ padding: '24px 0' }}>
        {/* Gate on the API key first: a returning user can have a persisted
            wallet but no key (sessionStorage is cleared on tab close), so the
            key must come before connect — otherwise reconnect mints against no
            key. Wallet auto-reconnect is held off until a key exists (see
            WalletProviders). */}
        {!hasApiKey && (
          <div style={{ padding: '48px 0', display: 'flex', justifyContent: 'center' }}>
            <ApiKeyGate title="An API key is required to continue" />
          </div>
        )}

        {hasApiKey && !isConnected && <PreConnect />}

        {hasApiKey && isConnected && !jwt && <LoadingScreen message="Authenticating…" />}

        {hasApiKey && isConnected && jwt && (
          <>
            <div>
              <MarketsTitle count={marketCount} />
              <MarketList
                onSelectMarket={setSelectedMarket}
                selectedMarketId={selectedMarket?.id}
                onTotalCount={onTotalCount}
              />
            </div>

            {/* Trade drawer — overlays from right, no layout shift */}
            <div
              className={`trade-drawer-backdrop${drawerOpen ? ' trade-drawer-backdrop--open' : ''}`}
              onClick={() => setSelectedMarket(null)}
            />
            <div className={`trade-drawer${drawerOpen ? ' trade-drawer--open' : ''}`}>
              <div className="trade-drawer__inner dimes-scroll">
                {selectedMarket && (
                  <TradePanel
                    market={selectedMarket}
                    onClose={() => setSelectedMarket(null)}
                  />
                )}
              </div>
            </div>

            {isConnected && (
              <div style={{ marginTop: 40 }}>
                <h2 style={sectionTitle}>Your positions</h2>
                <PositionList />
              </div>
            )}
          </>
        )}
      </main>
    </Layout>
  )
}

export default App
