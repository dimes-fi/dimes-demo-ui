// Shared connect-UI primitives. Kept in a non-component module so the
// component files (ConnectControls, HomeConnect) export only components — the
// react-refresh lint rule forbids mixing component and value exports, and these
// are imported by the lazily-loaded Turnkey UI too.

export interface MenuAction {
  label: string
  onClick: () => void
  danger?: boolean
}

export function shorten(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function btnStyle(compact: boolean): React.CSSProperties {
  return {
    padding: compact ? '6px 12px' : '10px 18px',
    fontSize: compact ? 12 : 13,
    fontWeight: 600,
    borderRadius: 0,
    border: '1px solid var(--border)',
    background: 'var(--surface-subtle)',
    color: 'var(--text)',
    cursor: 'pointer',
    fontFamily: 'var(--font)',
    lineHeight: 1.2,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    transition: 'background 0.15s ease, border-color 0.15s ease',
  }
}

export const primaryBtn: React.CSSProperties = {
  padding: '12px 18px',
  fontSize: 14,
  fontWeight: 700,
  borderRadius: 0,
  border: '1px solid var(--yellow)',
  background: 'var(--yellow)',
  color: 'var(--yellow-ink)',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  lineHeight: 1.2,
  width: '100%',
}

export const secondaryBtn: React.CSSProperties = {
  padding: '11px 18px',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 0,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface-subtle)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'var(--font)',
  lineHeight: 1.2,
  width: '100%',
}
