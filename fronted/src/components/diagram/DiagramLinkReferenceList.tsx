import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react'
import { Button } from '../Button'
import { formatLinkCode, formatLinkReference } from '../../utils/diagram/linkLabel'
import {
  EMPTY_LINK_REFERENCE_FILTERS,
  filterDiagramLinkReferences,
  hasActiveLinkReferenceFilters,
  type DiagramLinkReferenceFilters,
} from '../../utils/diagram/filterLinkReferences'
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
  /** Abrir modal para crear un enlace (origen y destino a elegir). */
  onCreateLink?: () => void
  /** Deshabilitar creación (p. ej. menos de dos equipos en el diagrama). */
  createDisabled?: boolean
  createDisabledReason?: string
  /** Enlaces con ruta manual desactualizada (cruzan un equipo). */
  staleLinkIds?: string[]
  /** Volver un enlace al ruteo automático. */
  onAutorouteLink?: (edgeId: string) => void
  /** Re-rutear todos los enlaces desactualizados. */
  onAutorouteAllStale?: () => void
}

type FilterChip = {
  key: string
  label: string
  onRemove: () => void
}

function deviceOptionLabel(
  deviceId: string,
  inventoryById: Map<string, TopologyNode>,
  containerByDeviceId: Record<string, string>,
  fallback: string
): string {
  const device = inventoryById.get(deviceId)
  const name = device?.label || fallback || 'Equipo'
  const container = containerByDeviceId[deviceId]
  return container ? `${name} · ${container}` : name
}

function uniqueSortedOptions(
  values: Array<{ value: string; label: string }>
): Array<{ value: string; label: string }> {
  const seen = new Set<string>()
  const unique: Array<{ value: string; label: string }> = []
  for (const option of values) {
    if (!option.value || seen.has(option.value)) continue
    seen.add(option.value)
    unique.push(option)
  }
  return unique.sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

const compactFieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

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
  onCreateLink,
  createDisabled = false,
  createDisabledReason,
  staleLinkIds = [],
  onAutorouteLink,
  onAutorouteAllStale,
}: Props) {
  const [filters, setFilters] = useState<DiagramLinkReferenceFilters>(EMPTY_LINK_REFERENCE_FILTERS)

  const inventoryById = useMemo(
    () => new Map(inventory.map((device) => [device.id, device])),
    [inventory]
  )

  const sorted = useMemo(
    () => [...edges].sort((a, b) => (a.code ?? 0) - (b.code ?? 0) || a.id.localeCompare(b.id)),
    [edges]
  )

  const filtered = useMemo(
    () => filterDiagramLinkReferences(sorted, inventory, containerByDeviceId, filters),
    [sorted, inventory, containerByDeviceId, filters]
  )

  const sourceOptions = useMemo(
    () =>
      uniqueSortedOptions(
        sorted.map((edge) => ({
          value: edge.source,
          label: deviceOptionLabel(
            edge.source,
            inventoryById,
            containerByDeviceId,
            edge.sourceLabel
          ),
        }))
      ),
    [sorted, inventoryById, containerByDeviceId]
  )

  const targetOptions = useMemo(
    () =>
      uniqueSortedOptions(
        sorted.map((edge) => ({
          value: edge.target,
          label: deviceOptionLabel(
            edge.target,
            inventoryById,
            containerByDeviceId,
            edge.targetLabel
          ),
        }))
      ),
    [sorted, inventoryById, containerByDeviceId]
  )

  const containerOptions = useMemo(() => {
    const names = new Set<string>()
    for (const edge of sorted) {
      const sourceContainer = containerByDeviceId[edge.source]
      const targetContainer = containerByDeviceId[edge.target]
      if (sourceContainer) names.add(sourceContainer)
      if (targetContainer) names.add(targetContainer)
    }
    return [...names]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map((name) => ({ value: name, label: name }))
  }, [sorted, containerByDeviceId])

  const filtersActive = hasActiveLinkReferenceFilters(filters)
  const staleSet = useMemo(() => new Set(staleLinkIds), [staleLinkIds])
  const showActions = Boolean(onEditLink || onDeleteLink || onAutorouteLink)

  const chips = useMemo<FilterChip[]>(() => {
    const next: FilterChip[] = []
    const query = filters.query.trim()
    if (query) {
      next.push({
        key: 'q',
        label: `Buscar: ${query}`,
        onRemove: () => setFilters((prev) => ({ ...prev, query: '' })),
      })
    }
    if (filters.sourceDeviceId) {
      const option = sourceOptions.find((item) => item.value === filters.sourceDeviceId)
      next.push({
        key: 'src',
        label: `Origen: ${option?.label ?? filters.sourceDeviceId}`,
        onRemove: () => setFilters((prev) => ({ ...prev, sourceDeviceId: '' })),
      })
    }
    if (filters.targetDeviceId) {
      const option = targetOptions.find((item) => item.value === filters.targetDeviceId)
      next.push({
        key: 'tgt',
        label: `Destino: ${option?.label ?? filters.targetDeviceId}`,
        onRemove: () => setFilters((prev) => ({ ...prev, targetDeviceId: '' })),
      })
    }
    if (filters.container) {
      next.push({
        key: 'loc',
        label: `Ubicación: ${filters.container}`,
        onRemove: () => setFilters((prev) => ({ ...prev, container: '' })),
      })
    }
    return next
  }, [filters, sourceOptions, targetOptions])

  const countLabel = !sorted.length
    ? ''
    : filtersActive
      ? ` (${filtered.length}/${sorted.length})`
      : ` (${sorted.length})`

  const createButton = onCreateLink ? (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      icon={<Plus className="h-3.5 w-3.5" />}
      onClick={onCreateLink}
      disabled={createDisabled}
      title={createDisabled ? createDisabledReason : 'Crear un enlace entre dos equipos'}
    >
      Nuevo enlace
    </Button>
  ) : null

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center gap-2 px-3 py-1.5">
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          aria-expanded={!collapsed}
        >
          <span>
            Referencia de enlaces
            {countLabel}
          </span>
          {collapsed ? (
            <ChevronUp className="h-3.5 w-3.5 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
          )}
        </button>
        {staleLinkIds.length > 0 && onAutorouteAllStale ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            icon={<RotateCcw className="h-3.5 w-3.5" />}
            onClick={onAutorouteAllStale}
            title="Recalcular automáticamente las rutas desactualizadas"
          >
            Re-rutear ({staleLinkIds.length})
          </Button>
        ) : null}
        {createButton}
      </div>

      {!collapsed ? (
        <div className="border-t border-slate-100 dark:border-slate-800">
          {sorted.length > 0 ? (
            <div className="space-y-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={filters.query}
                  onChange={(e) => setFilters((prev) => ({ ...prev, query: e.target.value }))}
                  placeholder="Buscar por ID, equipo, puerto, rack o descripción…"
                  aria-label="Buscar enlaces"
                  className={`${compactFieldClass} pl-8`}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Origen
                  </span>
                  <select
                    value={filters.sourceDeviceId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, sourceDeviceId: e.target.value }))
                    }
                    aria-label="Filtrar por equipo origen"
                    className={compactFieldClass}
                  >
                    <option value="">Todos</option>
                    {sourceOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Destino
                  </span>
                  <select
                    value={filters.targetDeviceId}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, targetDeviceId: e.target.value }))
                    }
                    aria-label="Filtrar por equipo destino"
                    className={compactFieldClass}
                  >
                    <option value="">Todos</option>
                    {targetOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ubicación
                  </span>
                  <select
                    value={filters.container}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, container: e.target.value }))
                    }
                    aria-label="Filtrar por rack o tablero"
                    className={compactFieldClass}
                    disabled={containerOptions.length === 0}
                  >
                    <option value="">Todas</option>
                    {containerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {filtersActive ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {chips.map((chip) => (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={chip.onRemove}
                        title="Quitar filtro"
                        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                      >
                        <span className="truncate">{chip.label}</span>
                        <span className="text-slate-400" aria-hidden>
                          ×
                        </span>
                      </button>
                    ))}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setFilters(EMPTY_LINK_REFERENCE_FILTERS)}
                  >
                    Limpiar
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="max-h-56 overflow-auto">
            {sorted.length === 0 ? (
              <div className="flex flex-col items-start gap-2 px-3 py-3">
                <p className="text-xs text-slate-500">No hay enlaces en este diagrama.</p>
                {onCreateLink ? (
                  <Button
                    type="button"
                    size="sm"
                    icon={<Plus className="h-3.5 w-3.5" />}
                    onClick={onCreateLink}
                    disabled={createDisabled}
                    title={createDisabled ? createDisabledReason : 'Crear un enlace entre dos equipos'}
                  >
                    Nuevo enlace
                  </Button>
                ) : null}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-slate-500">
                <p>Ningún enlace coincide con los filtros.</p>
                <button
                  type="button"
                  onClick={() => setFilters(EMPTY_LINK_REFERENCE_FILTERS)}
                  className="mt-2 font-semibold text-sky-700 hover:underline dark:text-sky-300"
                >
                  Limpiar filtros
                </button>
              </div>
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
                  {filtered.map((edge) => {
                    const code = formatLinkCode(edge.code)
                    const reference = formatLinkReference(edge, inventory, containerByDeviceId)
                    const isSelected = selectedLinkId === edge.id
                    const isStale = staleSet.has(edge.id)
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
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
