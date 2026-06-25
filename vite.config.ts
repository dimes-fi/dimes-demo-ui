/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    server: {
      deps: {
        // The SDK's ESM build does `import { camelizeKeys } from "humps"`, but humps
        // is CommonJS with no named ESM exports — strict ESM (vitest) throws on load.
        // Inlining routes the SDK through Vite's transform, which handles the interop.
        inline: ['@dimes-dot-fi/sdk'],
      },
    },
  },
  server: {
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
  build: {
    rollupOptions: {
      output: {
        // The wallet/crypto stack (viem, Privy, Turnkey, permissionless, wagmi)
        // pulls many @noble/@scure versions with interdependent module init.
        // Rolldown's default splitting put secp256k1 in a chunk whose hash
        // dependency lived in another chunk and was `undefined` at module-eval,
        // crashing the app on load ("Expected hash, got undefined"). Bundling
        // all of node_modules into one vendor chunk removes the inter-chunk
        // init-order boundaries entirely.
        advancedChunks: {
          // One vendor chunk so the @noble/@scure crypto init order stays correct
          // (default splitting left secp256k1's hash dep undefined → crash). But
          // EXCLUDE @turnkey: it's imported only by the lazily-loaded Turnkey
          // stack and its SDK throws at module-eval in a bundled web build, so it
          // must stay in the lazy chunk and out of the eager vendor chunk. The
          // negative lookahead drops any module path containing "@turnkey".
          groups: [{ name: 'vendor', test: /^(?!.*@turnkey).*[\\/]node_modules[\\/]/ }],
        },
      },
    },
  },
})
