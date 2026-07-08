import { useState, useCallback, useEffect } from 'react'
import { Drawer } from 'vaul'
import { useAccount } from 'wagmi'
import { useAutoAuth } from './hooks/useAutoAuth'
import { useErrorContext } from './hooks/useErrorContext'
import { useResolveDepositWallet } from './hooks/useResolveDepositWallet'
import { usePositionSocket } from './hooks/usePositionSocket'
import { useMarketSocket } from './hooks/useMarketSocket'
import { useSeedLiveMarkets } from './hooks/useSeedLiveMarkets'
import { usePositions } from './hooks/usePositions'
import { useIsMobile } from './hooks/useMediaQuery'
import { useAuthStore } from './store/auth'
import { isOpenPosition, type Market } from './api/types'
import { Layout } from './components/Layout'
import { BottomNav, type MobileTab } from './components/BottomNav'
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
  const isMobile = useIsMobile()
  const [mobileTab, setMobileTab] = useState<MobileTab>('markets')
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(null)
  const [marketCount, setMarketCount] = useState<number | undefined>(undefined)
  const onTotalCount = useCallback((n: number | undefined) => setMarketCount(n), [])

  // Open-position count drives the bottom-nav badge. Params match PositionList's
  // active query so React Query serves both from one cache entry (no extra
  // fetch). Only meaningful once authenticated.
  const { data: activePositions } = usePositions({
    sortBy: 'created_at',
    sortDirection: 'desc',
    state: 'active',
    expand: ['unwinds'],
  })
  const openCount = activePositions?.filter(isOpenPosition).length

  const drawerOpen = selectedMarket !== null

  // Keep the last-selected market mounted through the sheet's close animation
  // (vaul slides the content out after `open` flips false, so unmounting it
  // immediately would flash an empty sheet).
  const [lastMarket, setLastMarket] = useState<Market | null>(null)
  if (selectedMarket && selectedMarket !== lastMarket) setLastMarket(selectedMarket)
  const drawerMarket = selectedMarket ?? lastMarket

  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [drawerOpen])

  // On mobile the connected view is a two-tab shell (Markets / Positions); on
  // desktop both sections stack as before. `showMarkets`/`showPositions` gate
  // which section renders — desktop shows both regardless of the active tab.
  const showMarkets = !isMobile || mobileTab === 'markets'
  const showPositions = !isMobile || mobileTab === 'positions'

  return (
    <Layout>
      <ToastContainer />
      <DebugPanel />
      {hasApiKey && isConnected && <Header />}

      <main className="app-shell">
        {/* Gate on the API key first: a returning user can have a persisted
            wallet but no key (sessionStorage is cleared on tab close), so the
            key must come before connect — otherwise reconnect mints against no
            key. Wallet auto-reconnect is held off until a key exists (see
            WalletProviders). */}
        {!hasApiKey && (
          <div
            style={{
              minHeight: 'calc(100vh - 48px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <ApiKeyGate title="An API key is required to continue" />
          </div>
        )}

        {hasApiKey && !isConnected && <PreConnect />}

        {hasApiKey && isConnected && !jwt && <LoadingScreen message="Authenticating…" />}

        {hasApiKey && isConnected && jwt && (
          <>
            {showMarkets && (
              <div>
                <MarketsTitle count={marketCount} />
                <MarketList
                  onSelectMarket={setSelectedMarket}
                  selectedMarketId={selectedMarket?.id}
                  onTotalCount={onTotalCount}
                />
              </div>
            )}

            {/* Trade drawer — vaul bottom sheet on mobile (drag-to-dismiss,
                scroll-lock and animation handled by the lib); the CSS right-side
                panel on desktop. */}
            {isMobile ? (
              <Drawer.Root
                open={drawerOpen}
                onOpenChange={(open) => { if (!open) setSelectedMarket(null) }}
              >
                <Drawer.Portal>
                  <Drawer.Overlay className="vaul-overlay" />
                  <Drawer.Content className="vaul-drawer" aria-describedby={undefined}>
                    <Drawer.Handle className="vaul-handle" />
                    <Drawer.Title className="sr-only">Trade</Drawer.Title>
                    <div className="trade-drawer__inner dimes-scroll">
                      {drawerMarket && (
                        <TradePanel
                          market={drawerMarket}
                          onClose={() => setSelectedMarket(null)}
                        />
                      )}
                    </div>
                  </Drawer.Content>
                </Drawer.Portal>
              </Drawer.Root>
            ) : (
              <>
                <div
                  className={`trade-drawer-backdrop${drawerOpen ? ' trade-drawer-backdrop--open' : ''}`}
                  onClick={() => setSelectedMarket(null)}
                />
                <div className={`trade-drawer${drawerOpen ? ' trade-drawer--open' : ''}`}>
                  <div className="trade-drawer__inner dimes-scroll">
                    {drawerMarket && (
                      <TradePanel
                        market={drawerMarket}
                        onClose={() => setSelectedMarket(null)}
                      />
                    )}
                  </div>
                </div>
              </>
            )}

            {showPositions && (
              <div style={{ marginTop: isMobile ? 0 : 40 }}>
                <h2 style={sectionTitle}>Your positions</h2>
                <PositionList />
              </div>
            )}
          </>
        )}
      </main>

      {hasApiKey && isConnected && jwt && (
        <BottomNav active={mobileTab} onChange={setMobileTab} positionCount={openCount} />
      )}
    </Layout>
  )
}

export default App
