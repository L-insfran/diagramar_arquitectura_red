import { useEffect, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { Select } from '../Select'
import type { Area, RackFace, Site, TopologyData, TopologyRackSummary } from '../../types'
import {
  DEFAULT_TOPOLOGY_PRINT_FILTERS,
  describePrintFilters,
  filterTopologyForPrint,
  type TopologyPrintContent,
  type TopologyPrintFilters,
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
    subtitle: string
  }) => void | Promise<void>
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

  useEffect(() => {
    if (isOpen) setFilters(DEFAULT_TOPOLOGY_PRINT_FILTERS)
  }, [isOpen])

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

  const siteName = sites.find((s) => s.id === filters.siteId)?.name ?? null
  const areaName =
    (filters.siteId ? areasBySiteId[filters.siteId] : undefined)?.find((a) => a.id === filters.areaId)
      ?.name ?? null
  const rackNames = filters.rackIds
    .map((id) => racks.find((r) => r.id === id)?.name)
    .filter((n): n is string => !!n)

  const subtitle = describePrintFilters(filters, { siteName, areaName, rackNames })

  const toggleRack = (rackId: string) => {
    setFilters((prev) => {
      const has = prev.rackIds.includes(rackId)
      return {
        ...prev,
        rackIds: has ? prev.rackIds.filter((id) => id !== rackId) : [...prev.rackIds, rackId],
      }
    })
  }

  const handleConfirm = () => {
    void onConfirm({
      filters,
      filteredTopology: preview.topology,
      filteredRacks: preview.racks,
      subtitle,
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Imprimir reporte" size="lg">
      <div className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Elegí el sector de inventario y el contenido del PDF. El diagrama se captura del canvas
          filtrado; la tabla solo incluye enlaces cuyos extremos están en el alcance.
        </p>

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
                  onChange={() => setFilters((prev) => ({ ...prev, rackIds: [] }))}
                />
                <span className="font-medium text-gray-800 dark:text-gray-100">Todos los racks del alcance</span>
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
                          setFilters((prev) => ({ ...prev, rackIds: [rack.id] }))
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

        <div className="grid gap-4 sm:grid-cols-2">
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
          <Select
            label="Orientación PDF"
            value={filters.orientation}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                orientation: e.target.value as PrintOrientation,
              }))
            }
            options={[
              { value: 'landscape', label: 'Horizontal (A4)' },
              { value: 'portrait', label: 'Vertical (A4)' },
            ]}
          />
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={filters.includeUnracked}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, includeUnracked: e.target.checked }))
            }
          />
          <span>
            <span className="block text-sm font-medium text-gray-800 dark:text-gray-100">
              Incluir equipos sin rack
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Nodos sueltos del alcance (sitio/área) que no están montados.
            </span>
          </span>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">Contenido</legend>
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
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">{opt.label}</span>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">{opt.hint}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          <p className="font-semibold text-slate-900 dark:text-slate-100">Vista previa del alcance</p>
          <p className="mt-1">{subtitle}</p>
          <p className="mt-1 tabular-nums">
            {preview.topology.nodes.length} equipos · {preview.topology.edges.length} enlaces ·{' '}
            {preview.racks.length} racks
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
