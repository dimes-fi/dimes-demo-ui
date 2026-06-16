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
  source: 'toast' | 'window' | 'promise'
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
  const entries = read()
  entries.push({ ...entry, ts: Date.now() })
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

  const body = entries
    .map((e) => {
      const when = new Date(e.ts).toISOString()
      const lines = [`[${when}] ${e.level.toUpperCase()} (${e.source}): ${e.title}`]
      if (e.detail) lines.push(e.detail)
      return lines.join('\n')
    })
    .join('\n\n')

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
      detail: event.error?.stack ?? `${event.filename}:${event.lineno}:${event.colno}`,
      source: 'window',
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    logError({
      level: 'error',
      title: 'Unhandled promise rejection',
      detail: reason?.stack ?? (typeof reason === 'string' ? reason : safeStringify(reason)),
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
