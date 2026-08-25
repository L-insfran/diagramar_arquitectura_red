import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { LinkEndpointCell } from './LinkEndpointCell'
import {
  buildLinkEndpointPath,
  formatLinkCode,
  formatLinkReference,
} from '../../utils/diagram/linkLabel'
import type { DiagramLinkEdge, TopologyNode } from '../../types'

type Props = {
  edges: DiagramLinkEdge[]
  inventory: TopologyNode[]
  containerByDeviceId: Record<string, string>
  selectedLinkId?: string | null
  onSelectLink?: (edgeId: string) => void
  onEditLink?: (edgeId: string) => void
  onDeleteLink?: (edgeId: string) => void
  staleLinkIds?: string[]
  onAutorouteLink?: (edgeId: string) => void
}

export function LinkReferenceTable({
  edges,
  inventory,
  containerByDeviceId,
  selectedLinkId = null,
  onSelectLink,
  onEditLink,
  onDeleteLink,
  staleLinkIds = [],
  onAutorouteLink,
}: Props) {
  const inventoryById = new Map(inventory.map((device) => [device.id, device]))
  const staleSet = new Set(staleLinkIds)
  const showActions = Boolean(onEditLink || onDeleteLink || onAutorouteLink)

  return (
    <div className="max-h-56 overflow-auto">
      <table className="w-full text-left text-xs">
        <thead className="sticky top-0 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th className="w-14 px-3 py-1.5">ID</th>
            <th className="w-[30%] px-3 py-1.5">Origen</th>
            <th className="w-[30%] px-3 py-1.5">Destino</th>
            <th className="w-[20%] px-3 py-1.5">Descripción</th>
            {showActions ? (
              <th className="w-20 px-3 py-1.5 text-right">Acciones</th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {edges.map((edge) => {
            const code = formatLinkCode(edge.code)
            const originPath = buildLinkEndpointPath(
              edge.source,
              edge.sourcePort,
              inventoryById,
              containerByDeviceId
            )
            const destinationPath = buildLinkEndpointPath(
              edge.target,
              edge.targetPort,
              inventoryById,
              containerByDeviceId
            )
            const reference = formatLinkReference(edge, inventoryById, containerByDeviceId)
            const isSelected = selectedLinkId === edge.id
            const isStale = staleSet.has(edge.id)
            const canSelect = Boolean(onSelectLink)
            const canEdit = Boolean(onEditLink)
            const interactive = canSelect || canEdit
            const title = canEdit
              ? `${code}: ${reference} · clic para resaltar · doble clic para editar`
              : canSelect
                ? `${code}: ${reference} · clic para resaltar en el diagrama`
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
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block rounded border border-sky-300/70 bg-slate-950 px-1.5 py-0.5 text-[10px] font-bold text-sky-50 dark:border-sky-600/80">
                      {code}
                    </span>
                    {isStale ? (
                      <span
                        className="rounded border border-amber-400/80 bg-amber-50 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-600 dark:bg-amber-950/70 dark:text-amber-100"
                        title="La ruta editada cruza un equipo. Volvé a ruteo automático o reeditá el cable."
                      >
                        ruta
                      </span>
                    ) : null}
                  </span>
                </td>
                <td className="px-3 py-1.5 align-top">
                  <LinkEndpointCell path={originPath} />
                </td>
                <td className="px-3 py-1.5 align-top">
                  <LinkEndpointCell path={destinationPath} mirrored />
                </td>
                <td className="px-3 py-1.5 align-top text-slate-500 dark:text-slate-400">
                  {edge.description?.trim() || '—'}
                </td>
                {showActions ? (
                  <td className="px-2 py-1 align-top">
                    <div
                      className="flex items-center justify-end gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    >
                      {isStale && onAutorouteLink ? (
                        <button
                          type="button"
                          title={`Volver ${code} a ruteo automático`}
                          aria-label={`Volver ${code} a ruteo automático`}
                          className="rounded p-1 text-amber-600 hover:bg-amber-100 hover:text-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50 dark:hover:text-amber-100"
                          onClick={() => onAutorouteLink(edge.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
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
    </div>
  )
}
