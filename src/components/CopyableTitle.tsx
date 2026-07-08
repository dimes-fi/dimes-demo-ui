import { useCopyFlash } from '../hooks/useCopyFlash'

/**
 * Market title that copies its ticker on click. Feedback is a brief green flash
 * of the title text itself — no tag is added and no content changes, so the
 * title can't reflow and shift the surrounding card. Shared by the open-position
 * card, the settled card, the position detail drawer and the trade panel.
 */
export function CopyableTitle({
  text,
  copyValue,
  fontSize = 14,
  lineClamp = 2,
}: {
  /** Human-readable title shown to the user (never changes on copy). */
  text: string
  /** The value written to the clipboard (the market ticker). */
  copyValue: string
  fontSize?: number
  lineClamp?: number
}) {
  const { isCopied, copy } = useCopyFlash()
  const copied = isCopied()

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    copy(copyValue)
  }

  return (
    <div
      onClick={handleCopy}
      title={copied ? 'Ticker copied' : `${text} — click to copy ticker`}
      style={{
        fontSize,
        fontWeight: 600,
        color: copied ? 'var(--green)' : '#ffffff',
        overflow: 'hidden',
        display: '-webkit-box',
        WebkitLineClamp: lineClamp,
        WebkitBoxOrient: 'vertical',
        textOverflow: 'ellipsis',
        cursor: 'pointer',
        lineHeight: 1.3,
        transition: 'color 0.2s',
      }}
    >
      {text}
    </div>
  )
}
