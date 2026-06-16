import { apiFetchPublic } from './client';
import { getApiKey } from '../runtimeConfig';

// ---------------------------------------------------------------------------
// AUTH
//
// Mints auth tokens directly from the browser via POST /tokens, using the
// partner API key the user provides in the UI (stored in sessionStorage —
// this tab only). A wallet must be connected so the token can be scoped to it.
//
// This key-in-browser pattern exists because the app is a hosted reference
// demo. Real integrations should mint tokens on a backend with the API key
// kept server-side and hand the frontend a JWT. See README → "Auth".
// ---------------------------------------------------------------------------

interface TokenResponse {
  token: string;
  expiresAt: string;
}

// Optional override for the token endpoint's base URL. Leave unset to use
// VITE_API_URL like every other call; set this only when token minting is
// hosted on a separate domain.
const TOKEN_BASE_URL = import.meta.env.VITE_TOKEN_URL as string | undefined;

export async function requestAuthToken(connectedWallet?: string): Promise<TokenResponse> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('requestAuthToken: an API key is required. Set one in the UI.');
  }
  if (!connectedWallet) {
    throw new Error('requestAuthToken: a connected wallet address is required.');
  }
  return apiFetchPublic<TokenResponse>(
    '/v1/prediction-markets/tokens',
    {
      method: 'POST',
      headers: { Authorization: `Api-Key ${apiKey}` },
      body: JSON.stringify({ wallet_address: connectedWallet }),
    },
    TOKEN_BASE_URL,
  );
}
