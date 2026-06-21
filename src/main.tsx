import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@rainbow-me/rainbowkit/styles.css'
import './theme.css'
import './global.css'
import { config } from './config'
import { WalletProviders } from './WalletProviders'
import App from './App'

const queryClient = new QueryClient()

const isPreview = window.location.pathname === '/preview'

const root = ReactDOM.createRoot(document.getElementById('root')!)

if (isPreview) {
  import('./preview').then((mod) => {
    const Preview = mod.default
    root.render(
      <React.StrictMode>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <Preview />
          </QueryClientProvider>
        </WagmiProvider>
      </React.StrictMode>,
    )
  })
} else {
  root.render(
    <React.StrictMode>
      <WalletProviders>
        <App />
      </WalletProviders>
    </React.StrictMode>,
  )
}
