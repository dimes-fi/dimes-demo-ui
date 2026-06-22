import { getApiKey } from '../runtimeConfig'
import { ApiKeyGate } from './ApiKeyGate'
import { HomeConnect } from './HomeConnect'

/**
 * Pre-connect landing block. Centered logo + welcome blurb + API-key gate +
 * connect. Squared edges, muted palette — matches the Sandbox 2.0 UI.
 */
export function Hero() {
  const hasKey = Boolean(getApiKey())

  return (
    <section
      style={{
        minHeight: 'calc(100vh - 180px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '40px 20px',
      }}
    >
      <img
        src="/logo-dark.png"
        alt="Dimes"
        style={{
          height: 64,
          width: 'auto',
          display: 'block',
          marginBottom: 24,
        }}
      />

      <p
        style={{
          maxWidth: 620,
          color: 'var(--text-muted)',
          fontSize: 14,
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        Welcome to Dimes Sandbox. Browse live prediction markets, fetch
        leveraged quotes, and open YES/NO positions end-to-end on Polygon —
        available in both mock and production environments.
      </p>

      <div
        style={{
          marginTop: 28,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {!hasKey && <ApiKeyGate />}

        {hasKey && <HomeConnect />}

        <a
          href="https://docs.dimes.fi"
          target="_blank"
          rel="noreferrer"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-dim)',
            fontFamily: 'var(--font)',
            textDecoration: 'none',
            lineHeight: 1.2,
            transition: 'color 0.15s ease',
          }}
        >
          View docs →
        </a>
      </div>

      <p
        style={{
          marginTop: 14,
          fontSize: 11,
          color: 'var(--text-dim)',
          lineHeight: 1.4,
          maxWidth: 520,
        }}
      >
        Sandbox execution speed may be slower than production.
      </p>
    </section>
  )
}
