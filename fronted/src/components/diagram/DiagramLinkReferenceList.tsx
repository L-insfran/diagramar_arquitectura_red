import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { formatLinkCode, formatLinkReference } from '../../utils/diagram/linkLabel'
import type { DiagramLinkEdge, TopologyNode } from '../../types'

type Props = {
  edges: DiagramLinkEdge[]
  inventory: TopologyNode[]
  containerByDeviceId: Record<string, string>
  collapsed: boolean
  onToggle: () => void
  /** Enlace resaltado en el canvas (1 clic). */
  selectedLinkId?: string | null
  /** 1 clic → resaltar en el diagrama. */
  onSelectLink?: (edgeId: string) => void
  /** Abrir edición del enlace (botón o doble clic). */
  onEditLink?: (edgeId: string) => void
  /** Eliminar el enlace (abre confirmación en el padre). */
  onDeleteLink?: (edgeId: string) => void
}

export function DiagramLinkReferenceList({
  edges,
  inventory,
  containerByDeviceId,
  collapsed,
  onToggle,
  selectedLinkId = null,
  onSelectLink,
  onEditLink,
  onDeleteLink,
}: Props) {
  const sorted = [...edges].sort(
    (a, b) => (a.code ?? 0) - (b.code ?? 0) || a.id.localeCompare(b.id)
  )
  const showActions = Boolean(onEditLink || onDeleteLink)

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
        aria-expanded={!collapsed}
      >
        <span>
          Referencia de enlaces
          {sorted.length > 0 ? ` (${sorted.length})` : ''}
        </span>
        {collapsed ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
      </button>

      {!collapsed ? (
        <div className="max-h-48 overflow-auto border-t border-slate-100 dark:border-slate-800">
          {sorted.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-500">No hay enlaces en este diagrama.</p>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="w-14 px-3 py-1.5">ID</th>
                  <th className="px-3 py-1.5">Referencia</th>
                  <th className="w-1/4 px-3 py-1.5">Descripción</th>
                  {showActions ? (
                    <th className="w-20 px-3 py-1.5 text-right">Acciones</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {sorted.map((edge) => {
                  const code = formatLinkCode(edge.code)
                  const reference = formatLinkReference(edge, inventory, containerByDeviceId)
                  const isSelected = selectedLinkId === edge.id
                  const canSelect = Boolean(onSelectLink)
                  const canEdit = Boolean(onEditLink)
                  const interactive = canSelect || canEdit
                  const title = canEdit
                    ? `${code}: clic para resaltar · doble clic para editar`
                    : canSelect
                      ? `${code}: clic para resaltar en el diagrama`
                      : reference
                  return (
                    <tr
                      key={edge.id}
                      className={`border-t border-slate-100 dark:border-slate-800 ${
                        interactive ? 'cursor-pointer select-none' : ''
                      } ${
                        isSelected
                          ? 'bg-sky-100 dark:bg-sky-950/60'
                          : interactive
                            ? 'hover:bg-sky-50 dark:hover:bg-sky-950/40'
                            : ''
                      }`}
                      onClick={canSelect ? () => onSelectLink?.(edge.id) : undefined}
                      onDoubleClick={
                        canEdit
                          ? (e) => {
                              e.preventDefault()
                              onEditLink?.(edge.id)
                            }
                          : undefined
                      }
                      title={title}
                      aria-selected={isSelected}
                    >
                      <td className="px-3 py-1.5 align-top">
                        <span className="inline-block rounded border border-sky-300/70 bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-sky-50 dark:border-sky-600/80">
                          {code}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100">
                        {reference}
                      </td>
                      <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">
                        {edge.description?.trim() || '—'}
                      </td>
                      {showActions ? (
                        <td className="px-2 py-1 align-top">
                          <div
                            className="flex items-center justify-end gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => e.stopPropagation()}
                          >
                            {onEditLink ? (
                              <button
                                type="button"
                                title={`Editar ${code}`}
                                aria-label={`Editar ${code}`}
                                className="rounded p-1 text-slate-500 hover:bg-sky-100 hover:text-sky-700 dark:text-slate-400 dark:hover:bg-sky-950/50 dark:hover:text-sky-200"
                                onClick={() => onEditLink(edge.id)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                            {onDeleteLink ? (
                              <button
                                type="button"
                                title={`Eliminar ${code}`}
                                aria-label={`Eliminar ${code}`}
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                onClick={() => onDeleteLink(edge.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </div>
  )
}
