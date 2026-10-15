import { TruncatedText } from '../Tooltip'
import type { LinkPathCellSpan } from '../../utils/diagram/linkPathRows'

type Props = {
  /** Display value when not suppressed. */
  value: string | null
  /** Vertical merge for repeated hierarchy values. */
  span: LinkPathCellSpan
  /** Visual role for chip styling. */
  kind?: 'default' | 'port' | 'cable' | 'device'
  /** Show trailing chevron separator (except last segment of a group). */
  showSeparator?: boolean
  className?: string
}

const kindClass: Record<NonNullable<Props['kind']>, string> = {
  default: 'font-normal text-slate-600 dark:text-slate-300',
  device: 'font-medium text-slate-800 dark:text-slate-100',
  port: 'inline-block rounded border border-sky-300/70 bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-sky-50 dark:border-sky-600/80',
  cable:
    'inline-block rounded border border-violet-300/70 bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800 dark:border-violet-600/80 dark:bg-violet-950/60 dark:text-violet-100',
}

/**
 * Single segment cell for the linear path table.
 * Repeated hierarchy values use HTML rowspan so the label sits centered
 * across the block of rows it covers.
 */
export function LinkPathSegment({
  value,
  span,
  kind = 'default',
  showSeparator = false,
  className = '',
}: Props) {
  if ('skip' in span) return null

  const display = value?.trim() || '—'
  const title = display
  const rowSpan = Math.max(1, span.rowSpan)
  const merged = rowSpan > 1

  return (
    <td
      rowSpan={rowSpan}
      className={`px-1.5 py-1.5 align-middle ${
        merged
          ? 'border-x border-slate-200/80 bg-slate-50/90 dark:border-slate-700/80 dark:bg-slate-800/50'
          : ''
      } ${className}`}
      title={merged ? `${title} · ${rowSpan} enlaces` : title}
    >
      <div className="flex min-h-[1.5rem] min-w-0 items-center justify-center gap-1">
        {kind === 'port' || kind === 'cable' ? (
          <span className={`shrink-0 ${kindClass[kind]}`}>{display}</span>
        ) : (
          <TruncatedText
            text={display}
            className={`min-w-0 text-center text-[11px] ${kindClass[kind]} ${
              merged ? 'font-medium' : ''
            }`}
          />
        )}
        {showSeparator ? (
          <span className="shrink-0 text-[10px] text-slate-300 dark:text-slate-600" aria-hidden>
            ›
          </span>
        ) : null}
      </div>
    </td>
  )
}
