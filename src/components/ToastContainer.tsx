import { useEffect } from 'react'
import { useToastStore, type Toast } from '../store/toasts'

const variantColors: Record<Toast['variant'], string> = {
  success: 'var(--green)',
  info: 'var(--yellow)',
  warning: '#F5A623',
  error: 'var(--red)',
}

const variantIcons: Record<Toast['variant'], string[]> = {
  success: ['M20 6L9 17l-5-5'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z', 'M12 16v-4', 'M12 8h.01'],
  warning: ['M12 9v4', 'M12 17h.01', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'],
  error: ['M18 6L6 18', 'M6 6l12 12'],
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((s) => s.dismiss)
  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.durationMs)
    return () => clearTimeout(timer)
  }, [toast.id, toast.durationMs, dismiss])

  const accentColor = variantColors[toast.variant]

  return (
    <div
      style={{
        background: 'var(--card-elevated)',
        borderLeft: `3px solid ${accentColor}`,
        border: '1px solid var(--border-strong)',
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        padding: '12px 14px',
        minWidth: 280,
        maxWidth: 360,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        animation: 'toastSlideIn 0.25s ease-out',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={() => dismiss(toast.id)}
      role="alert"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={accentColor}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        {variantIcons[toast.variant].map((d, i) => (
          <path key={i} d={d} />
        ))}
      </svg>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            fontFamily: 'var(--font)',
            lineHeight: 1.3,
          }}
        >
          {toast.title}
        </div>
        {toast.description && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font)',
              marginTop: 2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.description}
          </div>
        )}
      </div>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
      <div
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column-reverse',
          gap: 8,
          pointerEvents: 'auto',
        }}
      >
        {toasts.slice(-5).map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </>
  )
}
