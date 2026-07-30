import type {
  RackFace,
  TopologyData,
  TopologyNode,
  TopologyRackSummary,
} from '../types'
import type { PrintOrientation } from './printDiagramSectorGrid'

export type TopologyPrintContent = 'table' | 'diagram' | 'full'

export type TopologyPrintFilters = {
  /** Vacío = todos los sitios. */
  siteId: string
  /** Vacío = todas las áreas del sitio (o todas). */
  areaId: string
  /** Vacío = todos los racks del alcance. */
  rackIds: string[]
  face: RackFace | 'both'
  includeUnracked: boolean
  content: TopologyPrintContent
  orientation: PrintOrientation
}

export const DEFAULT_TOPOLOGY_PRINT_FILTERS: TopologyPrintFilters = {
  siteId: '',
  areaId: '',
  rackIds: [],
  face: 'both',
  includeUnracked: true,
  content: 'full',
  orientation: 'landscape',
}

function normalizeFace(face: string | null | undefined): RackFace {
  return face === 'rear' ? 'rear' : 'front'
}

function deviceSiteId(node: TopologyNode, racksById: Map<string, TopologyRackSummary>): string | null {
  if (node.data.siteId) return node.data.siteId
  const rackId = node.data.rackId
  if (rackId) return racksById.get(rackId)?.siteId ?? null
  return null
}

function deviceAreaId(node: TopologyNode, racksById: Map<string, TopologyRackSummary>): string | null {
  if (node.data.areaId) return node.data.areaId
  const rackId = node.data.rackId
  if (rackId) return racksById.get(rackId)?.areaId ?? null
  return null
}

export function deviceMatchesPrintFilters(
  node: TopologyNode,
  filters: TopologyPrintFilters,
  racksById: Map<string, TopologyRackSummary>,
): boolean {
  const siteId = deviceSiteId(node, racksById)
  const areaId = deviceAreaId(node, racksById)

  if (filters.siteId && siteId !== filters.siteId) return false
  if (filters.areaId && areaId !== filters.areaId) return false

  const rackId = node.data.rackId ?? null
  if (rackId) {
    if (filters.rackIds.length > 0 && !filters.rackIds.includes(rackId)) return false
    if (filters.face !== 'both' && normalizeFace(node.data.rackFace) !== filters.face) return false
    return true
  }

  return filters.includeUnracked
}

export function filterRacksForPrint(
  racks: TopologyRackSummary[],
  filters: TopologyPrintFilters,
): TopologyRackSummary[] {
  return racks.filter((rack) => {
    if (filters.siteId && rack.siteId !== filters.siteId) return false
    if (filters.areaId && rack.areaId !== filters.areaId) return false
    if (filters.rackIds.length > 0 && !filters.rackIds.includes(rack.id)) return false
    return true
  })
}

/**
 * Subgrafo de topología según filtros de inventario (sitio/área/rack/cara).
 * Un enlace se incluye solo si ambos extremos están en el conjunto filtrado.
 */
export function filterTopologyForPrint(
  topology: TopologyData,
  racks: TopologyRackSummary[],
  filters: TopologyPrintFilters,
): { topology: TopologyData; racks: TopologyRackSummary[] } {
  const racksById = new Map(racks.map((r) => [r.id, r]))
  const filteredRacks = filterRacksForPrint(racks, filters)
  const allowedRackIds = new Set(filteredRacks.map((r) => r.id))

  const nodes = topology.nodes.filter((node) => {
    if (!deviceMatchesPrintFilters(node, filters, racksById)) return false
    const rackId = node.data.rackId
    if (rackId && !allowedRackIds.has(rackId) && filters.rackIds.length > 0) return false
    // Si hay filtro de racks vacío pero sitio/área redujo racks, solo montados en esos racks
    if (rackId && filteredRacks.length < racks.length && !allowedRackIds.has(rackId)) {
      // Equipo montado en rack fuera del alcance de sitio/área
      return false
    }
    return true
  })

  const nodeIds = new Set(nodes.map((n) => n.id))
  const edges = topology.edges.filter(
    (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
  )

  return {
    topology: { nodes, edges },
    racks: filteredRacks,
  }
}

export function describePrintFilters(
  filters: TopologyPrintFilters,
  labels: {
    siteName?: string | null
    areaName?: string | null
    rackNames?: string[]
  },
): string {
  const parts: string[] = []
  if (filters.siteId) parts.push(labels.siteName ? `Sitio: ${labels.siteName}` : 'Sitio filtrado')
  else parts.push('Todos los sitios')
  if (filters.areaId) parts.push(labels.areaName ? `Área: ${labels.areaName}` : 'Área filtrada')
  if (filters.rackIds.length === 1 && labels.rackNames?.[0]) {
    parts.push(`Rack: ${labels.rackNames[0]}`)
  } else if (filters.rackIds.length > 1) {
    parts.push(`${filters.rackIds.length} racks`)
  }
  if (filters.face === 'front') parts.push('Cara frontal')
  if (filters.face === 'rear') parts.push('Cara trasera')
  if (!filters.includeUnracked) parts.push('Sin equipos sueltos')
  return parts.join(' · ')
}
