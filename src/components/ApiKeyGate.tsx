import { useState } from 'react'
import { applySettings, detectEnvFromKey, getEnvironment } from '../runtimeConfig'

/**
 * Gate the user must clear before they can use the app: supply a partner API
 * key (stored in sessionStorage, this tab only). The environment is inferred
 * from the key prefix (dm_sbx_ → sandbox, dm_live_ → prod) and persisted, then
 * the page reloads so the API base / token address pick up the environment.
 *
 * Shown on the landing page before connect, and again if a wallet is already
 * connected but no key is set. Rendered as a compact, self-contained card so
 * it reads as a deliberate auth step rather than a stray input.
 */
export function ApiKeyGate({ title = 'Connect your API key' }: { title?: string }) {
  const [value, setValue] = useState('')
  const env = detectEnvFromKey(value)
  const ready = Boolean(value.trim())

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const key = value.trim()
    if (!key) return
    applySettings({ environment: env ?? getEnvironment(), apiKey: key })
  }

  return (
    <form onSubmit={submit} className="key-gate" aria-label="API key">
      <style>{`
        .key-gate {
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 20px;
          text-align: left;
          background: var(--surface);
          border: 1px solid var(--border);
          border-top: 2px solid var(--yellow);
          box-shadow: 0 12px 40px rgba(0,0,0,0.45);
        }
        .key-gate__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .key-gate__title {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--text);
        }
        .key-gate__env {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 3px 8px;
          border: 1px solid var(--border-strong);
          color: var(--text-dim);
          white-space: nowrap;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .key-gate__env[data-env="sandbox"] { color: var(--text); border-color: var(--text-muted); }
        .key-gate__env[data-env="prod"] {
          color: var(--yellow-ink); background: var(--yellow); border-color: var(--yellow);
        }
        .key-gate__row { display: flex; gap: 8px; align-items: stretch; }
        .key-gate__input {
          flex: 1 1 auto;
          min-width: 0;
          padding: 0 12px;
          height: 40px;
          font-size: 13px;
          font-family: var(--font-mono, ui-monospace, monospace);
          letter-spacing: 0.04em;
          border: 1px solid var(--border-strong);
          background: var(--surface-subtle);
          color: var(--text);
          outline: none;
          transition: border-color 0.15s ease;
        }
        .key-gate__input::placeholder { color: var(--text-dim); letter-spacing: 0; }
        .key-gate__input:focus { border-color: var(--yellow); }
        .key-gate__submit {
          flex: 0 0 auto;
          height: 40px;
          padding: 0 18px;
          font-size: 13px;
          font-weight: 700;
          font-family: var(--font);
          border: 1px solid var(--yellow);
          background: var(--yellow);
          color: var(--yellow-ink);
          cursor: pointer;
          transition: opacity 0.15s ease;
        }
        .key-gate__submit:disabled { opacity: 0.4; cursor: not-allowed; }
        .key-gate__submit:not(:disabled):hover { opacity: 0.88; }
        .key-gate__hint {
          font-size: 11px;
          line-height: 1.5;
          color: var(--text-dim);
        }
      `}</style>

      <div className="key-gate__head">
        <span className="key-gate__title">{title}</span>
        <span className="key-gate__env" data-env={env ?? ''}>
          {env === 'prod' ? 'Production' : env === 'sandbox' ? 'Sandbox' : 'Env auto-detect'}
        </span>
      </div>

      <div className="key-gate__row">
        <input
          className="key-gate__input"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="dm_sbx_… or dm_live_…"
          autoComplete="off"
          spellCheck={false}
          autoFocus
        />
        <button className="key-gate__submit" type="submit" disabled={!ready}>
          Continue
        </button>
      </div>

      <p className="key-gate__hint">
        Environment is detected from the key prefix. Stored in this tab's session
        only — cleared when you close the tab, never sent anywhere but Dimes.
      </p>
    </form>
  )
}
