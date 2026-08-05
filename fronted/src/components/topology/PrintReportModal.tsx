import { useMemo, useState, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { Select } from '../Select'
import type { Area, RackFace, Site, TopologyData, TopologyNode, TopologyRackSummary } from '../../types'
import {
  DEFAULT_TOPOLOGY_PRINT_FILTERS,
  countPrintScopeNodes,
  describePrintFilters,
  filterTopologyForPrint,
  type TopologyPrintContent,
  type TopologyPrintFilters,
  type TopologyPrintTableSortBy,
} from '../../utils/topologyPrintFilter'
import type { PrintOrientation } from '../../utils/printDiagramSectorGrid'

type Props = {
  isOpen: boolean
  onClose: () => void
  topology: TopologyData
  racks: TopologyRackSummary[]
  sites: Site[]
  areasBySiteId: Record<string, Area[]>
  exporting?: boolean
  onConfirm: (payload: {
    filters: TopologyPrintFilters
    filteredTopology: TopologyData
    filteredRacks: TopologyRackSummary[]
    externalNodesById: Map<string, TopologyNode>
    externalEdgeCount: number
    subtitle: string
  }) => void | Promise<void>
}

function withRackSelection(
  prev: TopologyPrintFilters,
  rackIds: string[],
  orientationTouched: boolean,
): TopologyPrintFilters {
  const next: TopologyPrintFilters = {
    ...prev,
    rackIds,
    // Al marcar racks concretos, desmarcar equipos sueltos (sigue toggable).
    includeUnracked: rackIds.length > 0 ? false : prev.includeUnracked,
  }
  // Sugerir vertical para 1–2 racks si el usuario no tocó la orientación.
  if (!orientationTouched && rackIds.length >= 1 && rackIds.length <= 2) {
    next.orientation = 'portrait'
  }
  return next
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
      {children}
    </h3>
  )
}

export function PrintReportModal({
  isOpen,
  onClose,
  topology,
  racks,
  sites,
  areasBySiteId,
  exporting,
  onConfirm,
}: Props) {
  const [filters, setFilters] = useState<TopologyPrintFilters>(DEFAULT_TOPOLOGY_PRINT_FILTERS)
  const [orientationTouched, setOrientationTouched] = useState(false)
  // Reset al abrir: patrón React "adjusting state when a prop changes" (sin useEffect).
  const [openEpoch, setOpenEpoch] = useState(isOpen)
  if (isOpen !== openEpoch) {
    setOpenEpoch(isOpen)
    if (isOpen) {
      setFilters(DEFAULT_TOPOLOGY_PRINT_FILTERS)
      setOrientationTouched(false)
    }
  }

  const areaOptions = useMemo(() => {
    if (!filters.siteId) return [{ value: '', label: 'Todas las áreas' }]
    const areas = areasBySiteId[filters.siteId] ?? []
    return [
      { value: '', label: 'Todas las áreas del sitio' },
      ...areas.map((a) => ({ value: a.id, label: a.name })),
    ]
  }, [areasBySiteId, filters.siteId])

  const rackOptions = useMemo(() => {
    return racks.filter((r) => {
      if (filters.siteId && r.siteId !== filters.siteId) return false
      if (filters.areaId && r.areaId !== filters.areaId) return false
      return true
    })
  }, [racks, filters.siteId, filters.areaId])

  const preview = useMemo(
    () => filterTopologyForPrint(topology, racks, filters),
    [topology, racks, filters],
  )

  const scopeCounts = useMemo(
    () => countPrintScopeNodes(preview.topology.nodes, racks),
    [preview.topology.nodes, racks],
  )

  /** Candidatos sueltos que entrarían si el check estuviera activo (misma lógica de sector). */
  const unrackedCandidateCount = useMemo(() => {
    const withUnracked = filterTopologyForPrint(topology, racks, {
      ...filters,
      includeUnracked: true,
    })
    return countPrintScopeNodes(withUnracked.topology.nodes, racks).unracked
  }, [topology, racks, filters])

  const hasRackSelection = filters.rackIds.length > 0

  const siteName = sites.find((s) => s.id === filters.siteId)?.name ?? null
  const areaName =
    (filters.siteId ? areasBySiteId[filters.siteId] : undefined)?.find((a) => a.id === filters.areaId)
      ?.name ?? null
  const rackNames = filters.rackIds
    .map((id) => racks.find((r) => r.id === id)?.name)
    .filter((n): n is string => !!n)

  const subtitle = describePrintFilters(filters, { siteName, areaName, rackNames })

  const setRackSelection = (rackIds: string[]) => {
    setFilters((prev) => withRackSelection(prev, rackIds, orientationTouched))
  }

  const toggleRack = (rackId: string) => {
    setFilters((prev) => {
      const has = prev.rackIds.includes(rackId)
      const rackIds = has ? prev.rackIds.filter((id) => id !== rackId) : [...prev.rackIds, rackId]
      return withRackSelection(prev, rackIds, orientationTouched)
    })
  }

  const handleConfirm = () => {
    void onConfirm({
      filters,
      filteredTopology: preview.topology,
      filteredRacks: preview.racks,
      externalNodesById: preview.externalNodesById,
      externalEdgeCount: preview.externalEdgeCount,
      subtitle,
    })
  }

  const suggestPortrait =
    !orientationTouched &&
    filters.rackIds.length >= 1 &&
    filters.rackIds.length <= 2 &&
    !filters.includeUnracked &&
    filters.orientation === 'portrait'

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imprimir reporte" size="lg">
      <div className="space-y-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Definí el alcance de inventario y el contenido del PDF. Con racks seleccionados se genera
          una elevación vectorial; la tabla incluye enlaces con al menos un extremo en el alcance.
        </p>

        {/* —— Alcance —— */}
        <section className="space-y-3">
          <SectionHeading>Alcance</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Sitio"
              value={filters.siteId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  siteId: e.target.value,
                  areaId: '',
                  rackIds: [],
                }))
              }
              options={[
                { value: '', label: 'Todos los sitios' },
                ...sites.map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <Select
              label="Área"
              value={filters.areaId}
              disabled={!filters.siteId}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  areaId: e.target.value,
                  rackIds: [],
                }))
              }
              options={areaOptions}
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Racks</p>
            {rackOptions.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                No hay racks en el alcance seleccionado.
              </p>
            ) : (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={filters.rackIds.length === 0}
                    onChange={() => setRackSelection([])}
                  />
                  <span className="font-medium text-gray-800 dark:text-gray-100">
                    Todos los racks del alcance
                  </span>
                </label>
                {rackOptions.map((rack) => {
                  const checked =
                    filters.rackIds.length === 0 ? false : filters.rackIds.includes(rack.id)
                  return (
                    <label
                      key={rack.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        checked={checked}
                        onChange={() => {
                          if (filters.rackIds.length === 0) {
                            setRackSelection([rack.id])
                          } else {
                            toggleRack(rack.id)
                          }
                        }}
                      />
                      <span className="min-w-0 truncate text-gray-800 dark:text-gray-100">
                        {rack.name}
                        {rack.code ? (
                          <span className="ml-1 font-mono text-[10px] text-gray-500">{rack.code}</span>
                        ) : null}
                      </span>
                      <span className="ml-auto shrink-0 text-[10px] text-gray-500">{rack.heightU}U</span>
                    </label>
                  )
                })}
              </div>
            )}
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              Si no marcás ninguno, se incluyen todos los racks del sitio/área.
            </p>
          </div>
        </section>

        {/* —— Equipos —— */}
        <section className="space-y-3">
          <SectionHeading>Equipos</SectionHeading>
          <Select
            label="Cara del rack"
            value={filters.face}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                face: e.target.value as RackFace | 'both',
              }))
            }
            options={[
              { value: 'both', label: 'Ambas caras' },
              { value: 'front', label: 'Solo frontal' },
              { value: 'rear', label: 'Solo trasera' },
            ]}
          />

          <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={filters.includeUnracked}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, includeUnracked: e.target.checked }))
              }
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
                  {hasRackSelection
                    ? 'Incluir equipos del mismo sector'
                    : 'Incluir equipos sin rack'}
                </span>
                <span className="tabular-nums text-[11px] text-gray-500 dark:text-gray-400">
                  {unrackedCandidateCount === 0
                    ? 'Ningún candidato'
                    : `${unrackedCandidateCount} candidato${unrackedCandidateCount === 1 ? '' : 's'}`}
                </span>
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {hasRackSelection
                  ? 'Equipos fuera de rack del área de los racks seleccionados. Se desmarca al elegir racks para enfocarse en el gabinete.'
                  : 'Nodos sueltos del alcance (sitio/área) que no están montados en un rack.'}
              </span>
            </span>
          </label>
        </section>

        {/* —— Presentación —— */}
        <section className="space-y-3">
          <SectionHeading>Presentación</SectionHeading>
          <div>
            <Select
              label="Orientación PDF"
              value={filters.orientation}
              onChange={(e) => {
                setOrientationTouched(true)
                setFilters((prev) => ({
                  ...prev,
                  orientation: e.target.value as PrintOrientation,
                }))
              }}
              options={[
                { value: 'landscape', label: 'Horizontal (A4)' },
                { value: 'portrait', label: 'Vertical (A4)' },
              ]}
            />
            {suggestPortrait ? (
              <p className="mt-1 text-[11px] text-blue-600 dark:text-blue-400">
                Sugerido: vertical — los racks son altos y caben mejor en A4 retrato.
              </p>
            ) : null}
          </div>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Contenido
            </legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  { value: 'full', label: 'Diagrama + tabla', hint: 'Reporte completo' },
                  { value: 'diagram', label: 'Solo diagrama', hint: 'Sin tabla de enlaces' },
                  { value: 'table', label: 'Solo tabla', hint: 'Sin captura del canvas' },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`cursor-pointer rounded-lg border px-3 py-2.5 transition ${
                    filters.content === opt.value
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40'
                      : 'border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name="print-content"
                    checked={filters.content === opt.value}
                    onChange={() =>
                      setFilters((prev) => ({
                        ...prev,
                        content: opt.value as TopologyPrintContent,
                      }))
                    }
                  />
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                    {opt.label}
                  </span>
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">{opt.hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {filters.content !== 'diagram' ? (
            <div>
              <Select
                label="Ordenar tabla por"
                value={filters.tableSortBy}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    tableSortBy: e.target.value as TopologyPrintTableSortBy,
                  }))
                }
                options={[
                  { value: 'source', label: 'Origen (equipo)' },
                  { value: 'target', label: 'Destino (equipo)' },
                ]}
              />
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Agrupa las filas por nombre de equipo y luego por puerto.
              </p>
            </div>
          ) : null}
        </section>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-slate-100">Vista previa del alcance</p>
          <p className="mt-1">{subtitle}</p>
          <p className="mt-1 tabular-nums">
            {scopeCounts.mounted} en rack · {scopeCounts.unracked} sueltos ·{' '}
            {preview.topology.edges.length} enlaces
            {preview.externalEdgeCount > 0
              ? ` (${preview.externalEdgeCount} hacia el exterior)`
              : ''}{' '}
            · {preview.racks.length} racks
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 pt-4 dark:border-gray-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={exporting}>
            Cancelar
          </Button>
          <Button
            type="button"
            icon={<Download className="h-4 w-4" />}
            onClick={handleConfirm}
            isLoading={exporting}
            disabled={exporting || (preview.topology.nodes.length === 0 && preview.racks.length === 0)}
          >
            Generar PDF
          </Button>
        </div>
      </div>
    </Modal>
  )
}
