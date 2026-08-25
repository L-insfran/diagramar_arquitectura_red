import { TruncatedText } from '../Tooltip'
import type { LinkEndpointPath } from '../../utils/diagram/linkLabel'
import { formatEndpointLocationText, formatEndpointPathText } from '../../utils/diagram/linkLabel'

type Props = {
  path: LinkEndpointPath
  /** Destination: port first, right-aligned. */
  mirrored?: boolean
}

const locationSep = ' › '

export function LinkEndpointCell({ path, mirrored = false }: Props) {
  const locationParts = [path.site, path.area, path.container].filter(Boolean) as string[]
  const locationLabel = locationParts.length
    ? (mirrored ? [...locationParts].reverse() : locationParts).join(locationSep)
    : '—'
  const fullText = formatEndpointPathText(path, { mirrored })
  const locationPlain = formatEndpointLocationText(path) || '—'

  const portChip = (
    <span className="inline-block shrink-0 rounded border border-sky-300/70 bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-sky-50 dark:border-sky-600/80">
      {path.port}
    </span>
  )

  const deviceName = (
    <TruncatedText
      text={path.device}
      className="min-w-0 font-medium text-slate-800 dark:text-slate-100"
    />
  )

  return (
    <div
      className={`min-w-0 space-y-0.5 ${mirrored ? 'text-right' : 'text-left'}`}
      title={fullText}
    >
      <TruncatedText
        text={locationLabel === '—' ? locationPlain : locationLabel}
        className="text-[10px] font-normal text-slate-500 dark:text-slate-400"
      />
      <div
        className={`flex min-w-0 items-center gap-1.5 ${
          mirrored ? 'flex-row-reverse justify-start' : 'flex-row'
        }`}
      >
        {deviceName}
        {portChip}
      </div>
    </div>
  )
}
