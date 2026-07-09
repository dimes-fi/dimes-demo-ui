# dimes-demo-ui

A React + Vite reference frontend for the [Dimes](https://dimes.fi) leveraged
prediction markets API. Fork it, wire it to your own backend, and ship.

## What it shows

- How to authenticate against the Dimes API
- How to fetch markets and user positions
- The **draft → promote** quoting flow: fetch a draft quote (no expiry
  pressure), let the user review, then promote to a signed quote and
  immediately open the wallet — hiding the 15s signature window entirely
- Approve USDC and submit a leveraged position to the on-chain vault,
  including EIP-712 signature verification
- A minimal, themable UI intended as a starting point

## Quote flow

The UI uses a two-step quoting flow for better UX:

1. **Draft** — `POST /v1/prediction-markets/draft-offers` returns pricing and
   fees without a chain signature. No countdown, no expiry — the user reviews
   at their own pace.
2. **Promote** — when the user clicks "Create position",
   `POST /v1/prediction-markets/promoted-offers/{draft_offer_id}` re-runs the
   pipeline and returns a fully signed quote. The UI opens the wallet
   immediately; the 15s signature window is never shown.
3. **Market moved** — if promotion fails because conditions changed, the UI
   auto-fetches a new draft, highlights what changed inline (entry price,
   fees, total cost), and offers "Accept Changes" or "Cancel".

See `src/hooks/useTradeMachine.ts` for the state machine and
`src/api/offers.ts` for the API calls.

## Quickstart

```sh
cp .env.example .env.local
pnpm install
pnpm dev
```

Open <http://localhost:5173>. By default, the demo talks to
`https://api-sandbox.dimes.fi` and mints **sandbox-only JWTs pinned to a
fixed demo wallet** — you can browse markets, request quotes, and view mock
positions without a wallet. Connect a wallet on Polygon (or Polygon Amoy
testnet) to approve USDC and create sandbox positions end-to-end.

## Configuration

All config is read from Vite environment variables. See
[`.env.example`](./.env.example) for the authoritative list.

| Variable                            | Default                                | Purpose                                                                                                                                                                                                                                            |
|-------------------------------------|----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `VITE_API_URL`                      | `https://api-sandbox.dimes.fi`         | Dimes API base URL.                                                                                                                                                                                                                                |
| `VITE_RELAYER_URL`                  | _(unset)_                              | Optional base-URL override for the deposit-wallet relayer endpoint (`POST /v1/prediction-markets/relayer-submissions`) only. Leave empty to route through `VITE_API_URL`. Set only when the relayer is on a separate domain.                       |
| `VITE_TOKEN_URL`                    | _(unset)_                              | Optional base-URL override for the auth token endpoints (`POST /v1/prediction-markets/tokens` and `/demo-token`) only. Leave empty to route through `VITE_API_URL`. Set only when token minting is on a separate domain.                           |
| `VITE_CHAIN_ID`                     | `137`                                  | `137` = Polygon mainnet, `80002` = Polygon Amoy testnet.                                                                                                                                                                                           |
| `VITE_RPC_URL`                      | _(unset)_                              | Optional custom RPC endpoint; leave empty to use wagmi's default.                                                                                                                                                                                  |
| `VITE_USDC_ADDRESS`                 | _(sandbox mock)_                       | Collateral token the vault accepts. Defaults to the sandbox mock USDC so the demo works out of the box. See [Chains and contracts](#chains-and-contracts) for prod/testnet values.                                                                 |
| `VITE_WALLETCONNECT_PROJECT_ID`     | _(demo id bundled in `src/config.ts`)_ | Get a free project id at <https://cloud.walletconnect.com> if you fork for production. WalletConnect project ids are public identifiers, not secrets.                                                                                              |
| `VITE_PRIVY_APP_ID`                 | _(unset)_                              | When set, swaps the default RainbowKit wallet stack for [Privy](https://privy.io) (embedded wallets + Privy login). See [Wallet backends](#wallet-backends-rainbowkit-privy-or-turnkey). Privy app ids are public client identifiers, not secrets. |
| `VITE_TURNKEY_ORG_ID`               | _(unset)_                              | Turnkey organization ID. Set together with `VITE_TURNKEY_AUTH_PROXY_CONFIG_ID` to use the [Turnkey](https://turnkey.com) wallet stack. Public identifier, not a secret.                                                                            |
| `VITE_TURNKEY_AUTH_PROXY_CONFIG_ID` | _(unset)_                              | Turnkey WalletKit / Auth Proxy config ID (from the dashboard). Required alongside the org id for Turnkey.                                                                                                                                          |
| `VITE_API_KEY`                      | _(unset)_                              | ⚠ **Demo-only.** See below.                                                                                                                                                                                                                        |

## Auth: demo vs real ⚠

By default (`VITE_API_KEY` unset) the frontend runs in **demo mode**:
`POST /v1/prediction-markets/demo-token` mints a sandbox JWT scoped to the
fixed demo wallet `0xCB93661f8120A082a59642455b776311e1726420`. That wallet
is the only address the endpoint accepts, so every request — markets,
positions, quotes — is scoped to it regardless of which wallet the user has
connected. Users still connect their own wallet to sign on-chain
transactions; the JWT just always speaks for the demo wallet.

If you set `VITE_API_KEY`, the frontend instead calls
`POST /v1/prediction-markets/tokens` with `Authorization: Api-Key <key>` and
the connected wallet address, and the JWT is scoped to that wallet.

**Do not ship a real API key in a production frontend.** Anyone who loads
your app can read the key from the bundle or from devtools. In a real
integration:

1. Keep the API key on your backend.
2. Expose a `POST /auth` (or similar) endpoint on your backend that takes
   the connected wallet address, calls Dimes' `POST /tokens` from the
   server, and returns the resulting JWT to the client.
3. Replace `src/api/auth.ts` with a call to your backend.

The `VITE_API_KEY` path exists in this repo purely so the demo runs
end-to-end with a single command, and the module is commented to make that
clear.

## Wallet backends: RainbowKit, Privy, or Turnkey

The demo ships with three interchangeable wallet backends. Config keys pick
which one mounts — **everything downstream is unchanged** because the on-chain
layer (`src/contract/hooks.ts`) talks only to wagmi. `walletBackend()` in
`src/runtimeConfig.ts` resolves the choice.

**Auto-default precedence: Privy > RainbowKit.** Turnkey is *never* an
auto-default even when its ids are set — it mounts only on an explicit user
selection (the "Connect with Turnkey" button), which persists the choice and
reloads into the Turnkey stack. The order on every home page is fixed: Connect a
wallet · Privy · deposit · **Turnkey (always last)**.

| Config                                                      | Backend    | Connect UX                                                                           |
|-------------------------------------------------------------|------------|--------------------------------------------------------------------------------------|
| _none_ (default)                                            | RainbowKit | MetaMask / Coinbase / Phantom / WalletConnect modal                                  |
| `VITE_PRIVY_APP_ID`                                         | Privy      | Privy login (email / social / external wallet) + embedded wallet                     |
| `VITE_TURNKEY_ORG_ID` + `VITE_TURNKEY_AUTH_PROXY_CONFIG_ID` | Turnkey    | Turnkey login (email OTP / passkey / OAuth) + embedded wallet — explicit-select only |

Privy and Turnkey both provision an embedded wallet on Polygon and run the
normal approve → `createPosition` → `requestClose` flow against it.

### Wallet-type detection

Whatever a backend connects — a plain EOA, a Gnosis Safe (1-of-1), a Polymarket
deposit wallet, or another smart-contract account — `useWalletKind`
(`src/contract/useWalletKind.ts`) classifies it from on-chain code (+ a
`getOwners()` probe) and routes the opening flow automatically:

| Detected                     | Flow                                                                                                                                                               |
|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| EOA                          | Direct `approve` + `createPosition`.                                                                                                                               |
| Gnosis Safe / other contract | Direct flow — the wallet's own provider relays the vault calls, so the contract is `msg.sender`. The quote's `wallet_address` is the connected (contract) address. |
| Polymarket deposit wallet    | Auto-enables the push-funded relayer batch (a direct `approve` is blocked for these). Shown as a toggle so the owner can fall back to trading as the EOA.          |

The detected type is shown as a badge in the header. This replaces the old
manual "Use Deposit Wallet" toggle with automatic routing.

### Using Privy

1. Create an app in the [Privy dashboard](https://dashboard.privy.io) and copy
   its **App ID** (a public client identifier, not a secret).
2. Set it and run:

   ```bash
   VITE_PRIVY_APP_ID=cmxxxxxxxxxxxxxxxxxxxxxxxx pnpm dev
   # or add VITE_PRIVY_APP_ID=… to .env.local
   ```

3. Click **Connect wallet** — you'll get Privy's login modal instead of
   RainbowKit. After login, Privy provisions an embedded wallet (for users
   without one) on Polygon.

Privy supports two on-chain flows. Which one runs is detected automatically (the
header shows a badge for the active wallet type):

**EOA flow (default).** The embedded wallet is a plain EOA. `msg.sender` is that
EOA, and the standard `approve` → `createPosition` → `requestClose` runs against
it — identical to any externally-connected EOA. Nothing special.

**Smart-wallet flow (Account Abstraction).** If you enable **Smart wallets** in
the Privy dashboard, a logged-in user also gets an ERC-4337 smart account, and
that contract becomes `msg.sender`:

- Auth/quotes are scoped to the **smart-account address** (not the owner EOA),
  exactly like deposit-wallet mode — see `smartWalletAddress` in `store/auth.ts`.
- Opening a position is a **single batched userOperation** (`approve` +
  `createPosition`) via the smart-wallet client; closing is one `requestClose`
  userOp. See `contract/smartWalletHooks.ts`.
- The faucet and balance display follow the smart account, so test USDC is
  minted there (`contract/hooks.ts` `useMintSandboxUsdc`).

Dashboard setup for AA:

1. Enable **Smart wallets** and choose an implementation (Kernel, Safe, …).
2. Set a **bundler URL**. Use a keyed Pimlico endpoint —
   `https://api.pimlico.io/v2/137/rpc?apikey=<key>` — **not** the public
   `public.pimlico.io` one, which blocks browser CORS.
3. Optionally attach a **paymaster / sponsorship policy** for gasless. Without
   one, the smart account pays its own gas, so fund it with a little POL before
   the first open (the first userOp also deploys the account). Its USDC
   collateral comes from the faucet.

The account pill opens a dropdown (address + copy, USDC balance, **Fund
wallet**, **Export wallet key** for embedded wallets, **Disconnect**) wired to
Privy's hooks (`useFundWallet`, `useExportWallet`).

### Using Turnkey

Turnkey needs two ids from the [dashboard](https://dashboard.turnkey.com): your
**Organization ID** and a **WalletKit / Auth Proxy config ID** (enable Auth
Proxy and pick auth methods — email OTP, passkey, OAuth — first).

```bash
VITE_TURNKEY_ORG_ID=<org-uuid> \
VITE_TURNKEY_AUTH_PROXY_CONFIG_ID=<config-uuid> \
pnpm dev
# or add both to .env.local
```

Since Turnkey is explicit-select only, every home page shows **Connect with
Turnkey** as the last button; clicking it persists the choice, reloads into the
Turnkey stack, and auto-opens the login modal. After login the app derives a
viem account from the user's Ethereum wallet account and the rest of the flow is
identical.

Unlike Privy, **Turnkey ships no wagmi connector**, so the demo includes a small
custom one:

- `src/turnkey/provider.ts` — wraps the Turnkey viem account in an EIP-1193
  provider (delegates signing/sending to a viem walletClient, reads fall through
  to the RPC).
- `src/turnkey/connector.ts` — the wagmi connector, fed by a module-level holder.
- `src/turnkey/TurnkeyStack.tsx` (`TurnkeyBridge`) — the lazy-loaded provider
  stack (`@turnkey/react-wallet-kit` throws at module-eval in a bundled build, so
  it's only evaluated when Turnkey is active). On login it builds the account via
  `@turnkey/viem` `createAccount`, populates the holder, and connects wagmi; on
  logout it clears and disconnects. Any failure surfaces as a toast.
- **Wallet provisioning.** A freshly signed-up user may have no embedded wallet,
  and the SDK doesn't always hydrate `wallets` into state. The bridge handles
  this: when authenticated with no wallets it calls `refreshWallets()`, and if
  there's still none, `createWallet({ accounts: ['ADDRESS_FORMAT_ETHEREUM'] })`,
  then proceeds — guarded to run once.

### How the switch is wired

| File                                            | Role                                                                                                                                       |
|-------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `src/runtimeConfig.ts`                          | `walletBackend()` — the single source of truth (Privy > RainbowKit; Turnkey explicit-select only). `selectBackend()` persists + reloads.   |
| `src/WalletProviders.tsx`                       | Mounts the RainbowKit, Privy, or Turnkey provider stack accordingly.                                                                       |
| `src/config.privy.ts` / `src/config.turnkey.ts` | Each backend's wagmi config (same chain/transport as `config.ts`).                                                                         |
| `src/components/HomeConnect.tsx`                | The shared `HomeButtons` — identical pre-connect layout for every backend; native action for the active one, switch+reload for the others. |
| `src/components/ConnectControls.tsx`            | One connect UI for all three backends; shared `AccountMenuShell` dropdown.                                                                 |

Because the mode is fixed at page load (a settings change forces a reload),
the backend never flips between renders, so the per-backend hooks stay stable.

## Where to look

| Path                | Contents                                                                                                    |
|---------------------|-------------------------------------------------------------------------------------------------------------|
| `src/api/`          | One file per resource. `client.ts` is the HTTP wrapper with JWT auth + 401 retry.                           |
| `src/hooks/`        | `useTradeMachine` (draft→promote state machine), React Query wrappers, `useAutoAuth`.                       |
| `src/contract/`     | Vault ABI, wagmi hooks for `approve`, `createPosition`, `requestClose`, and EIP-712 signature verification. |
| `src/components/`   | UI, kept deliberately small and un-clever. `ui/` has shared primitives (`Button`, `Input`, `Field`).        |
| `src/store/auth.ts` | Zustand store holding the active JWT.                                                                       |
| `src/theme.css`     | Design tokens (colors, type scale, radii). Customize here first.                                            |

The pre-connect landing page and the post-connect app are both in
`src/App.tsx`. A `/preview` route renders every component with mock data —
useful while tweaking styles.

## Chains and contracts

| Environment | Chain           | Chain ID | USDC (collateral token)                                       |
|-------------|-----------------|----------|---------------------------------------------------------------|
| Sandbox     | Polygon mainnet | `137`    | `0xD477EDbe627E94639d7E92119Ca62a461c6ce555` (mock)           |
| Production  | Polygon mainnet | `137`    | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` (bridged USDC.e) |
| Testnet     | Polygon Amoy    | `80002`  | `0x5fb7b0527851267c1ab138cac8dbcd224b411135` (mock)           |

Set `VITE_USDC_ADDRESS` to the row that matches your `VITE_API_URL`. The
default in `.env.example` is the sandbox mock.

The vault address and signer public key are fetched at runtime from
`GET /v1/prediction-markets/contract-info`.

## Scripts

| Command         | What it does                          |
|-----------------|---------------------------------------|
| `pnpm dev`      | Start the Vite dev server.            |
| `pnpm build`    | Type-check and build for production.  |
| `pnpm lint`     | Run ESLint.                           |
| `pnpm test`     | Run the Vitest suite.                 |
| `pnpm preview`  | Preview the production build locally. |

## License

MIT
