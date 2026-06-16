import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  clearErrorLog,
  formatErrorLog,
  getErrorLog,
  subscribeErrorLog,
  type ErrorLogEntry,
} from '../utils/errorLog'

function useErrorLog(): ErrorLogEntry[] {
  return useSyncExternalStore(subscribeErrorLog, getErrorLog, getErrorLog)
}

const levelColor: Record<ErrorLogEntry['level'], string> = {
  error: 'var(--red)',
  warning: '#F5A623',
}

export function DebugPanel() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const entries = useErrorLog()

  // Discreet keyboard shortcut: Ctrl/Cmd + Shift + D
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const copy = () => {
    void navigator.clipboard?.writeText(formatErrorLog())
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <>
      {/* Discreet trigger — small dot, bottom-left. Glows red when errors exist. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Diagnostics (Ctrl/Cmd+Shift+D)"
        aria-label="Open diagnostics"
        style={{
          position: 'fixed',
          bottom: 10,
          left: 10,
          zIndex: 9998,
          width: 12,
          height: 12,
          borderRadius: '50%',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          background: entries.length > 0 ? 'var(--red)' : 'var(--border-strong)',
          opacity: entries.length > 0 ? 0.7 : 0.25,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={(e) =>
          (e.currentTarget.style.opacity = entries.length > 0 ? '0.7' : '0.25')
        }
      />

      {open && (
        <div
          style={{
            position: 'fixed',
            bottom: 32,
            left: 16,
            zIndex: 9999,
            width: 'min(460px, calc(100vw - 32px))',
            maxHeight: '70vh',
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--card-elevated)',
            border: '1px solid var(--border-strong)',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontFamily: 'var(--font)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              borderBottom: '1px solid var(--border-strong)',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Diagnostics
              <span style={{ color: 'var(--text-dim)', marginLeft: 8, fontWeight: 400 }}>
                {entries.length} {entries.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" onClick={copy} style={btnStyle}>
                {copied ? 'Copied' : 'Copy for AI'}
              </button>
              <button
                type="button"
                onClick={clearErrorLog}
                disabled={entries.length === 0}
                style={{ ...btnStyle, opacity: entries.length === 0 ? 0.4 : 1 }}
              >
                Clear
              </button>
              <button type="button" onClick={() => setOpen(false)} style={btnStyle}>
                ✕
              </button>
            </div>
          </div>

          <div className="dimes-scroll" style={{ overflowY: 'auto', padding: 8 }}>
            {entries.length === 0 ? (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-dim)',
                  padding: '16px 8px',
                  textAlign: 'center',
                }}
              >
                No errors recorded. If you hit a wallet or chain error, it will show
                up here — then hit “Copy for AI” and paste it to your assistant.
              </div>
            ) : (
              [...entries].reverse().map((e, i) => (
                <div
                  key={i}
                  style={{
                    padding: '8px 10px',
                    borderLeft: `3px solid ${levelColor[e.level]}`,
                    background: 'var(--card)',
                    borderRadius: 4,
                    marginBottom: 6,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--text)',
                    }}
                  >
                    <span style={{ overflowWrap: 'anywhere' }}>{e.title}</span>
                    <span style={{ color: 'var(--text-dim)', flexShrink: 0, fontWeight: 400 }}>
                      {new Date(e.ts).toLocaleTimeString()}
                    </span>
                  </div>
                  {e.detail && (
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        marginTop: 4,
                        whiteSpace: 'pre-wrap',
                        overflowWrap: 'anywhere',
                        fontFamily: 'monospace',
                      }}
                    >
                      {e.detail}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}

const btnStyle: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  color: 'var(--text)',
  fontSize: 11,
  fontFamily: 'var(--font)',
  padding: '4px 8px',
  cursor: 'pointer',
}
