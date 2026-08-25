import { TruncatedText } from '../Tooltip'

type Props = {
  /** Display value when not suppressed. */
  value: string | null
  /** True when this segment matches the previous row (cascade). */
  repeated: boolean
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
 * Repeated segments show a continuity guide instead of an empty cell.
 */
export function LinkPathSegment({
  value,
  repeated,
  kind = 'default',
  showSeparator = false,
  className = '',
}: Props) {
  const display = value?.trim() || '—'
  const title = display

  if (repeated) {
    return (
      <td
        className={`relative bg-slate-50/80 px-1.5 py-1.5 align-middle dark:bg-slate-800/40 ${className}`}
        title={`${title} (igual que la fila anterior)`}
      >
        <span className="sr-only">{display}</span>
        <div className="flex h-full min-h-[1.5rem] items-stretch gap-1">
          <div
            className="mx-auto w-px flex-1 border-l border-dashed border-slate-300 dark:border-slate-600"
            aria-hidden
          />
          {showSeparator ? (
            <span className="self-center text-[10px] text-slate-300 dark:text-slate-600" aria-hidden>
              ›
            </span>
          ) : null}
        </div>
      </td>
    )
  }

  return (
    <td className={`px-1.5 py-1.5 align-middle ${className}`} title={title}>
      <div className="flex min-w-0 items-center gap-1">
        {kind === 'port' || kind === 'cable' ? (
          <span className={`shrink-0 ${kindClass[kind]}`}>{display}</span>
        ) : (
          <TruncatedText text={display} className={`min-w-0 text-[11px] ${kindClass[kind]}`} />
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
