/**
 * Full-bleed loading screen shown while the wallet connects and the session
 * token is fetched (connected-but-no-JWT window). Sharp edges, muted palette,
 * yellow accent — matches the Sandbox 2.0 UI. The indeterminate bar and the
 * scanning blocks read as "working" without implying a known progress amount.
 */
export function LoadingScreen({ message = 'Connecting…' }: { message?: string }) {
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
      <style>{`
        @keyframes loadLogoPulse {
          0%, 100% { opacity: 0.55; }
          50% { opacity: 1; }
        }
        @keyframes loadBarSweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        @keyframes loadBlockPulse {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 1; }
        }
      `}</style>

      <img
        src="/logo-dark.png"
        alt="Dimes"
        style={{
          height: 56,
          width: 'auto',
          display: 'block',
          marginBottom: 28,
          animation: 'loadLogoPulse 1.8s ease-in-out infinite',
        }}
      />

      {/* Indeterminate track — squared, with a yellow sweep. */}
      <div
        style={{
          position: 'relative',
          width: 220,
          height: 3,
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            width: '25%',
            background: 'var(--yellow)',
            boxShadow: '0 0 8px rgba(238, 255, 0, 0.5)',
            animation: 'loadBarSweep 1.2s cubic-bezier(0.65, 0, 0.35, 1) infinite',
          }}
        />
      </div>

      {/* Scanning blocks — a small staggered cadence under the bar. */}
      <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              background: 'var(--yellow)',
              animation: 'loadBlockPulse 1.2s ease-in-out infinite',
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>

      <p
        style={{
          marginTop: 22,
          fontSize: 'var(--fs-sm)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontFamily: 'var(--font)',
          margin: '22px 0 0',
        }}
      >
        {message}
      </p>
    </section>
  )
}
