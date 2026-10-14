import type { LinkTypeLegendItem } from '../../utils/diagram/linkTypeStyle'
import { LinkLineSample } from './LinkLineSample'

type Props = {
  items: LinkTypeLegendItem[]
}

/** Leyenda fija del canvas: un color por tipo de enlace presente. */
export function DiagramLinkLegend({ items }: Props) {
  if (items.length === 0) return null
  return (
    <div className="pointer-events-none max-w-xs rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md dark:border-slate-600 dark:bg-slate-900/95">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Tipos de enlace
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <LinkLineSample lineStyle={item.lineStyle} color={item.color} width={28} />
            <span className="truncate">{item.label}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
