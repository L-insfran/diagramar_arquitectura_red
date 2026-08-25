import { Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { LinkPathSegment } from './LinkPathSegment'
import { formatLinkPathLine, type AnnotatedLinkPathRow } from '../../utils/diagram/linkPathRows'

type Props = {
  rows: AnnotatedLinkPathRow[]
  selectedLinkId?: string | null
  onSelectLink?: (edgeId: string) => void
  onEditLink?: (edgeId: string) => void
  onDeleteLink?: (edgeId: string) => void
  staleLinkIds?: string[]
  onAutorouteLink?: (edgeId: string) => void
}

const thClass =
  'px-1.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400'
const groupThClass =
  'border-b border-slate-200 px-1.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400'

export function LinkPathTable({
  rows,
  selectedLinkId = null,
  onSelectLink,
  onEditLink,
  onDeleteLink,
  staleLinkIds = [],
  onAutorouteLink,
}: Props) {
  const staleSet = new Set(staleLinkIds)
  const showActions = Boolean(onEditLink || onDeleteLink || onAutorouteLink)

  return (
    <div className="max-h-56 overflow-auto">
      <table className="w-max min-w-full text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800">
          <tr>
            <th rowSpan={2} className={`${thClass} w-14 border-b border-slate-200 dark:border-slate-700`}>
              ID
            </th>
            <th colSpan={5} className={groupThClass}>
              Origen
            </th>
            <th rowSpan={2} className={`${thClass} border-b border-slate-200 dark:border-slate-700`}>
              Enlace
            </th>
            <th colSpan={5} className={groupThClass}>
              Destino
            </th>
            <th
              rowSpan={2}
              className={`${thClass} min-w-[6rem] border-b border-slate-200 dark:border-slate-700`}
            >
              Descripción
            </th>
            {showActions ? (
              <th
                rowSpan={2}
                className={`${thClass} w-20 border-b border-slate-200 text-right dark:border-slate-700`}
              >
                Acciones
              </th>
            ) : null}
          </tr>
          <tr>
            <th className={thClass}>Sitio</th>
            <th className={thClass}>Área</th>
            <th className={thClass}>Contenedor</th>
            <th className={thClass}>Equipo</th>
            <th className={thClass}>Puerto</th>
            <th className={thClass}>Puerto</th>
            <th className={thClass}>Equipo</th>
            <th className={thClass}>Contenedor</th>
            <th className={thClass}>Área</th>
            <th className={thClass}>Sitio</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { edge, code, origin, destination, cable, repeat, groupStart } = row
            const isSelected = selectedLinkId === edge.id
            const isStale = staleSet.has(edge.id)
            const canSelect = Boolean(onSelectLink)
            const canEdit = Boolean(onEditLink)
            const interactive = canSelect || canEdit
            const reference = formatLinkPathLine(row)
            const title = canEdit
              ? `${code}: ${reference} · clic para resaltar · doble clic para editar`
              : canSelect
                ? `${code}: ${reference} · clic para resaltar en el diagrama`
                : reference

            return (
              <tr
                key={edge.id}
                className={`border-t ${
                  groupStart
                    ? 'border-t-slate-300 dark:border-t-slate-600'
                    : 'border-t-slate-100 dark:border-t-slate-800'
                } ${interactive ? 'cursor-pointer select-none' : ''} ${
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
                <td className="px-2 py-1.5 align-middle">
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

                <LinkPathSegment value={origin.site} repeated={repeat.originSite} showSeparator />
                <LinkPathSegment value={origin.area} repeated={repeat.originArea} showSeparator />
                <LinkPathSegment
                  value={origin.container}
                  repeated={repeat.originContainer}
                  showSeparator
                />
                <LinkPathSegment
                  value={origin.device}
                  repeated={repeat.originDevice}
                  kind="device"
                  showSeparator
                />
                <LinkPathSegment value={origin.port} repeated={false} kind="port" showSeparator />

                <LinkPathSegment
                  value={cable}
                  repeated={repeat.cable}
                  kind="cable"
                  showSeparator
                />

                <LinkPathSegment
                  value={destination.port}
                  repeated={false}
                  kind="port"
                  showSeparator
                />
                <LinkPathSegment
                  value={destination.device}
                  repeated={repeat.destinationDevice}
                  kind="device"
                  showSeparator
                />
                <LinkPathSegment
                  value={destination.container}
                  repeated={repeat.destinationContainer}
                  showSeparator
                />
                <LinkPathSegment
                  value={destination.area}
                  repeated={repeat.destinationArea}
                  showSeparator
                />
                <LinkPathSegment value={destination.site} repeated={repeat.destinationSite} />

                <td className="max-w-[10rem] px-2 py-1.5 align-middle text-slate-500 dark:text-slate-400">
                  <span className="line-clamp-2">{edge.description?.trim() || '—'}</span>
                </td>

                {showActions ? (
                  <td className="px-2 py-1 align-middle">
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
