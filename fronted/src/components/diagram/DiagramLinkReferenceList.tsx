import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, RotateCcw } from 'lucide-react'
import { Button } from '../Button'
import { SegmentedControl } from '../SegmentedControl'
import { LinkReferenceFilterBar } from './LinkReferenceFilterBar'
import { LinkReferenceTable } from './LinkReferenceTable'
import { LinkPathTable } from './LinkPathTable'
import {
  EMPTY_LINK_REFERENCE_FILTERS,
  buildLinkReferenceFilterOptions,
  filterAndAnnotateLinkPathRows,
  filterDiagramLinkReferences,
  hasActiveLinkReferenceFilters,
  type DiagramLinkReferenceFilters,
} from '../../utils/diagram/filterLinkReferences'
import { buildLinkPathRows } from '../../utils/diagram/linkPathRows'
import type { DiagramLinkEdge, TopologyNode } from '../../types'

type LinkReferenceView = 'table' | 'path'

const VIEW_STORAGE_KEY = 'nm.diagram.linkReferenceView'

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

function readStoredView(): LinkReferenceView {
  try {
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
    if (raw === 'path' || raw === 'table') return raw
  } catch {
    /* ignore */
  }
  return 'path'
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
  onCreateLink,
  createDisabled = false,
  createDisabledReason,
  staleLinkIds = [],
  onAutorouteLink,
  onAutorouteAllStale,
}: Props) {
  const [filters, setFilters] = useState<DiagramLinkReferenceFilters>(EMPTY_LINK_REFERENCE_FILTERS)
  const [view, setView] = useState<LinkReferenceView>(readStoredView)

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, view)
    } catch {
      /* ignore */
    }
  }, [view])

  const sortedByCode = useMemo(
    () => [...edges].sort((a, b) => (a.code ?? 0) - (b.code ?? 0) || a.id.localeCompare(b.id)),
    [edges]
  )

  const allPathRows = useMemo(
    () => buildLinkPathRows(edges, inventory, containerByDeviceId),
    [edges, inventory, containerByDeviceId]
  )

  const filterOptions = useMemo(
    () => buildLinkReferenceFilterOptions(allPathRows, filters),
    [allPathRows, filters]
  )

  const filteredTableEdges = useMemo(
    () => filterDiagramLinkReferences(sortedByCode, inventory, containerByDeviceId, filters),
    [sortedByCode, inventory, containerByDeviceId, filters]
  )

  const annotatedPathRows = useMemo(
    () => filterAndAnnotateLinkPathRows(edges, inventory, containerByDeviceId, filters),
    [edges, inventory, containerByDeviceId, filters]
  )

  const filtersActive = hasActiveLinkReferenceFilters(filters)
  const filteredCount = view === 'path' ? annotatedPathRows.length : filteredTableEdges.length

  const countLabel = !sortedByCode.length
    ? ''
    : filtersActive
      ? ` (${filteredCount}/${sortedByCode.length})`
      : ` (${sortedByCode.length})`

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
      <div className="flex flex-wrap items-center gap-2 px-3 py-1.5">
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
        {!collapsed && sortedByCode.length > 0 ? (
          <SegmentedControl
            value={view}
            onChange={setView}
            ariaLabel="Vista de referencia de enlaces"
            options={[
              { value: 'table', label: 'Tabla', title: 'Vista clásica origen / destino' },
              {
                value: 'path',
                label: 'Ruta lineal',
                title: 'Cadena sitio → … → puerto → cable → puerto → … → sitio',
              },
            ]}
          />
        ) : null}
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
          {sortedByCode.length > 0 ? (
            <LinkReferenceFilterBar
              filters={filters}
              onChange={setFilters}
              options={filterOptions}
            />
          ) : null}

          {sortedByCode.length === 0 ? (
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
          ) : filteredCount === 0 ? (
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
          ) : view === 'path' ? (
            <LinkPathTable
              rows={annotatedPathRows}
              selectedLinkId={selectedLinkId}
              onSelectLink={onSelectLink}
              onEditLink={onEditLink}
              onDeleteLink={onDeleteLink}
              staleLinkIds={staleLinkIds}
              onAutorouteLink={onAutorouteLink}
            />
          ) : (
            <LinkReferenceTable
              edges={filteredTableEdges}
              inventory={inventory}
              containerByDeviceId={containerByDeviceId}
              selectedLinkId={selectedLinkId}
              onSelectLink={onSelectLink}
              onEditLink={onEditLink}
              onDeleteLink={onDeleteLink}
              staleLinkIds={staleLinkIds}
              onAutorouteLink={onAutorouteLink}
            />
          )}
        </div>
      ) : null}
    </div>
  )
}
