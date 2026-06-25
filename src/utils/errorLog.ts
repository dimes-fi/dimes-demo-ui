// Persistent client-side error log.
//
// Demo users frequently hit wallet/chain errors that only surface as toasts and
// vanish on reload. They can't use the browser console, but they do paste into
// LLMs — so we keep a capped ring buffer in localStorage and expose it through
// the discreet DebugPanel for a one-click copy.

const STORAGE_KEY = 'dimes.errorLog.v1'
const MAX_ENTRIES = 50

export interface ErrorLogEntry {
  ts: number
  level: 'error' | 'warning'
  title: string
  detail?: string
  // Full stack trace of the underlying error, when one was available at the
  // call site. This is what actually helps debugging — the toast `detail` is
  // just the human-readable message.
  stack?: string
  // Snapshot of app/wallet state at the moment of the error (wallet address,
  // chain, auth mode, connector, …). Captured automatically from the registered
  // context provider, merged with any caller-supplied context.
  context?: Record<string, unknown>
  source: 'toast' | 'window' | 'promise'
}

// A registered getter that returns a snapshot of live app state (wallet, chain,
// auth mode) at log time. Lives outside React so logError() — which is called
// from stores, global listeners, etc. — can capture it without prop-drilling.
type ContextProvider = () => Record<string, unknown>
let contextProvider: ContextProvider | null = null

export function setErrorContextProvider(provider: ContextProvider | null) {
  contextProvider = provider
}

/** Pull a stack trace (or best-effort string) out of an arbitrary thrown value. */
export function extractStack(error: unknown): string | undefined {
  if (!error) return undefined
  if (error instanceof Error) return error.stack ?? `${error.name}: ${error.message}`
  if (typeof error === 'object') {
    const stack = (error as { stack?: unknown }).stack
    if (typeof stack === 'string') return stack
    return safeStringify(error)
  }
  if (typeof error === 'string') return error
  return String(error)
}

type Listener = () => void
const listeners = new Set<Listener>()

// Cached snapshot so getErrorLog() returns a stable reference between writes.
// useSyncExternalStore loops infinitely if the snapshot identity changes every call.
let cache: ErrorLogEntry[] | null = null

function read(): ErrorLogEntry[] {
  if (cache) return cache
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    cache = Array.isArray(parsed) ? parsed : []
  } catch {
    cache = []
  }
  return cache
}

function write(entries: ErrorLogEntry[]) {
  cache = entries
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // storage full / unavailable — nothing actionable, keep going
  }
  listeners.forEach((l) => l())
}

export function logError(entry: Omit<ErrorLogEntry, 'ts'>) {
  let snapshot: Record<string, unknown> | undefined
  try {
    snapshot = contextProvider?.()
  } catch {
    // a broken provider must never swallow the error we're trying to log
  }
  const context =
    snapshot || entry.context ? { ...snapshot, ...entry.context } : undefined

  const entries = read()
  entries.push({ ...entry, context, ts: Date.now() })
  write(entries.slice(-MAX_ENTRIES))
}

export function getErrorLog(): ErrorLogEntry[] {
  return read()
}

export function clearErrorLog() {
  write([])
}

export function subscribeErrorLog(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function envHeader(): string {
  const env = {
    url: typeof location !== 'undefined' ? location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    chainId: import.meta.env.VITE_CHAIN_ID ?? '(default)',
    appVersion: import.meta.env.VITE_APP_VERSION ?? '0.1.0',
  }
  return [
    'Dimes demo UI — client diagnostics',
    `time: ${new Date().toISOString()}`,
    `url: ${env.url}`,
    `chainId: ${env.chainId}`,
    `appVersion: ${env.appVersion}`,
    `userAgent: ${env.userAgent}`,
    '',
  ].join('\n')
}

function formatEntryBody(e: ErrorLogEntry): string {
  const when = new Date(e.ts).toISOString()
  const lines = [`[${when}] ${e.level.toUpperCase()} (${e.source}): ${e.title}`]
  if (e.detail) lines.push(e.detail)
  if (e.context && Object.keys(e.context).length > 0) {
    lines.push('', 'context:')
    for (const [k, v] of Object.entries(e.context)) {
      lines.push(`  ${k}: ${typeof v === 'string' ? v : safeStringify(v)}`)
    }
  }
  if (e.stack) lines.push('', e.stack)
  return lines.join('\n')
}

/** Plain-text dump of a single entry, with env header — for the per-row copy button. */
export function formatErrorEntry(entry: ErrorLogEntry): string {
  return `${envHeader()}${formatEntryBody(entry)}`
}

/** Plain-text dump intended to be pasted into an LLM for help. */
export function formatErrorLog(): string {
  const entries = read()
  const env = {
    url: typeof location !== 'undefined' ? location.href : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    chainId: import.meta.env.VITE_CHAIN_ID ?? '(default)',
    appVersion: import.meta.env.VITE_APP_VERSION ?? '0.1.0',
  }
  const header = [
    'Dimes demo UI — client diagnostics',
    `time: ${new Date().toISOString()}`,
    `url: ${env.url}`,
    `chainId: ${env.chainId}`,
    `appVersion: ${env.appVersion}`,
    `userAgent: ${env.userAgent}`,
    '',
  ].join('\n')

  if (entries.length === 0) {
    return `${header}(no errors recorded)`
  }

  const body = entries.map(formatEntryBody).join('\n\n')

  return `${header}${body}`
}

let installed = false

/** Capture uncaught errors + unhandled rejections that never make it to a toast. */
export function installGlobalErrorCapture() {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    logError({
      level: 'error',
      title: event.message || 'Uncaught error',
      stack: extractStack(event.error) ?? `${event.filename}:${event.lineno}:${event.colno}`,
      source: 'window',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    logError({
      level: 'error',
      title: 'Unhandled promise rejection',
      stack: extractStack(event.reason),
      source: 'promise',
    })
  })
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
