/**
 * Polymarket builder API credentials for the local-demo direct-relayer flow.
 *
 * Sourced from env config ONLY (VITE_BUILDER_API_KEY / _SECRET / _PASSPHRASE) —
 * there is intentionally no UI to enter them. When all three are present, the
 * push-funded batch is submitted straight to the relayer from the browser,
 * bypassing the partner-API-key-guarded backend endpoint.
 */
import type { BuilderCreds } from '../api/relayer';

const apiKey = (import.meta.env.VITE_BUILDER_API_KEY as string | undefined)?.trim() ?? '';
const apiSecret = (import.meta.env.VITE_BUILDER_API_SECRET as string | undefined)?.trim() ?? '';
const apiPassphrase = (import.meta.env.VITE_BUILDER_API_PASSPHRASE as string | undefined)?.trim() ?? '';

/** True only when all three creds are configured via env. */
export const hasBuilderCreds = Boolean(apiKey && apiSecret && apiPassphrase);

export function getBuilderCreds(): BuilderCreds {
  return { apiKey, apiSecret, apiPassphrase };
}
