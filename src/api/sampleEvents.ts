import { apiFetchPublic } from './publicFetch';
import { getApiBase } from '../runtimeConfig';
import { useAuthStore } from '../store/auth';

export interface SampleEventsResult {
  /** Total number of events that will arrive over the WebSocket connection. */
  eventCount: number;
  /** Delay between two consecutive events, in milliseconds. */
  intervalMs: number;
}

/**
 * Ask the API to push one mock event of every WebSocket type onto this session's
 * connection, one per second. Nothing is created or persisted — the payloads carry
 * a position ID and ticker that do not exist. Rate limited to one call per 30s.
 *
 * Deliberately NOT in the SDK: this is a test-harness endpoint, not something a
 * production integration calls, so it is a plain authenticated fetch here.
 */
export async function requestSampleEvents(): Promise<SampleEventsResult> {
  const { jwt } = useAuthStore.getState();
  if (!jwt) {
    throw new Error('Sign in first — sample events are delivered to your own connection.');
  }

  return apiFetchPublic<SampleEventsResult>(
    '/v1/prediction-markets/sample-events',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
    },
    getApiBase(),
  );
}
