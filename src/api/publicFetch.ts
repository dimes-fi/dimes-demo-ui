import { DimesApiError } from '@dimes-dot-fi/sdk';
import { camelizeKeys } from '../utils/format';

// Minimal unauthenticated fetch helper for the two Api-Key endpoints the SDK
// does not cover: token minting (POST /tokens) and relayer submission. Every
// JWT-authenticated call goes through the SDK's DimesClient instead — see
// `dimesClient.ts`. The caller supplies the `Authorization: Api-Key ...` header.

interface ApiErrorBody {
  error?: {
    type?: string;
    code?: string;
    message?: string;
    params?: Record<string, unknown>;
  };
}

async function throwFromResponse(response: Response): Promise<never> {
  const rawBody = await response.text();
  let parsed: ApiErrorBody | null = null;
  try {
    parsed = rawBody ? (JSON.parse(rawBody) as ApiErrorBody) : null;
  } catch {
    parsed = null;
  }
  const code = parsed?.error?.code ?? null;
  const type = parsed?.error?.type ?? null;
  const message = parsed?.error?.message ?? code ?? rawBody ?? `API error ${response.status}`;
  const rawParams = parsed?.error?.params;
  const params =
    rawParams && typeof rawParams === 'object' ? camelizeKeys<Record<string, unknown>>(rawParams) : null;
  throw new DimesApiError({
    status: response.status,
    code: code ?? 'unknown_error',
    type,
    message: message ?? 'Unknown error',
    params,
  });
}

/** Unauthenticated POST/GET that camelizes the JSON response. `baseUrl` overrides the default API base. */
export async function apiFetchPublic<T>(path: string, options: RequestInit, baseUrl: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });

  if (!response.ok) {
    await throwFromResponse(response);
  }
  if (response.status === 204 || response.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return camelizeKeys<T>(await response.json());
}
