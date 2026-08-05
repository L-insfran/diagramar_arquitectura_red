import type {
  RackFace,
  TopologyData,
  TopologyNode,
  TopologyRackSummary,
} from '../types'
import type { PrintOrientation } from './printDiagramSectorGrid'

export type TopologyPrintContent = 'table' | 'diagram' | 'full'

/** Cómo incluir enlaces respecto al alcance de nodos. */
export type TopologyPrintEdgeScope = 'any-end' | 'both-ends'

/** Criterio de orden de filas en la tabla de conexiones del PDF. */
export type TopologyPrintTableSortBy = 'source' | 'target'

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
  /**
   * `any-end` (default): incluye enlaces con al menos un extremo en el alcance.
   * `both-ends`: solo enlaces cuyos dos extremos están en el alcance.
   */
  edgeScope: TopologyPrintEdgeScope
  /** Orden de la tabla PDF: por equipo de origen o de destino. */
  tableSortBy: TopologyPrintTableSortBy
}

export const DEFAULT_TOPOLOGY_PRINT_FILTERS: TopologyPrintFilters = {
  siteId: '',
  areaId: '',
  rackIds: [],
  face: 'both',
  includeUnracked: true,
  content: 'full',
  orientation: 'landscape',
  edgeScope: 'any-end',
  tableSortBy: 'source',
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

/**
 * Resuelve el rackId efectivo: montaje directo o vía bandeja del rack.
 */
function effectiveRackId(
  node: TopologyNode,
  accessoryToRack: Map<string, string>,
): string | null {
  if (node.data.rackId) return node.data.rackId
  const accId = node.data.supportedByAccessoryId
  if (accId && accessoryToRack.has(accId)) return accessoryToRack.get(accId)!
  return null
}

function buildAccessoryToRack(racks: TopologyRackSummary[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const rack of racks) {
    for (const acc of rack.accessories ?? []) map.set(acc.id, rack.id)
  }
  return map
}

/**
 * Áreas de inventario (sectores) de los racks seleccionados.
 * Usado para acotar equipos sin rack al mismo sector que los gabinetes elegidos.
 */
export function sectorIdsForSelectedRacks(
  rackIds: string[],
  racksById: Map<string, TopologyRackSummary>,
): Set<string> {
  const areas = new Set<string>()
  for (const id of rackIds) {
    const areaId = racksById.get(id)?.areaId
    if (areaId) areas.add(areaId)
  }
  return areas
}

export function deviceMatchesPrintFilters(
  node: TopologyNode,
  filters: TopologyPrintFilters,
  racksById: Map<string, TopologyRackSummary>,
  accessoryToRack: Map<string, string>,
): boolean {
  const siteId = deviceSiteId(node, racksById)
  const areaId = deviceAreaId(node, racksById)

  if (filters.siteId && siteId !== filters.siteId) return false
  if (filters.areaId && areaId !== filters.areaId) return false

  const rackId = effectiveRackId(node, accessoryToRack)
  if (rackId) {
    if (filters.rackIds.length > 0 && !filters.rackIds.includes(rackId)) return false
    if (filters.face !== 'both' && normalizeFace(node.data.rackFace) !== filters.face) {
      const fullDepth = !!node.data.isFullDepth || node.data.rackFace === 'both'
      if (!fullDepth) return false
    }
    return true
  }

  if (!filters.includeUnracked) return false

  // Con racks concretos: solo sueltos del mismo sector (área) que esos racks.
  if (filters.rackIds.length > 0) {
    if (!areaId) return false
    const sectorIds = sectorIdsForSelectedRacks(filters.rackIds, racksById)
    return sectorIds.has(areaId)
  }

  return true
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

export type FilterTopologyForPrintResult = {
  topology: TopologyData
  racks: TopologyRackSummary[]
  /** Nodos fuera del alcance referenciados por enlaces any-end (solo etiquetas). */
  externalNodesById: Map<string, TopologyNode>
  /** Cantidad de enlaces con un extremo fuera del alcance. */
  externalEdgeCount: number
}

/**
 * Subgrafo de topología según filtros de inventario (sitio/área/rack/cara).
 * Con `edgeScope: 'any-end'` un enlace se incluye si al menos un extremo está en el alcance;
 * el extremo externo se guarda en `externalNodesById` (no entra al diagrama).
 */
export function filterTopologyForPrint(
  topology: TopologyData,
  racks: TopologyRackSummary[],
  filters: TopologyPrintFilters,
): FilterTopologyForPrintResult {
  const racksById = new Map(racks.map((r) => [r.id, r]))
  const filteredRacks = filterRacksForPrint(racks, filters)
  const allowedRackIds = new Set(filteredRacks.map((r) => r.id))
  const accessoryToRack = buildAccessoryToRack(racks)

  const nodes = topology.nodes.filter((node) => {
    if (!deviceMatchesPrintFilters(node, filters, racksById, accessoryToRack)) return false
    const rackId = effectiveRackId(node, accessoryToRack)
    if (rackId && !allowedRackIds.has(rackId) && filters.rackIds.length > 0) return false
    if (rackId && filteredRacks.length < racks.length && !allowedRackIds.has(rackId)) {
      return false
    }
    return true
  })

  const nodeIds = new Set(nodes.map((n) => n.id))
  const allNodesById = new Map(topology.nodes.map((n) => [n.id, n]))
  const externalNodesById = new Map<string, TopologyNode>()
  const edgeScope = filters.edgeScope ?? 'any-end'

  const edges = topology.edges.filter((edge) => {
    const sourceIn = nodeIds.has(edge.source)
    const targetIn = nodeIds.has(edge.target)
    if (edgeScope === 'both-ends') {
      return sourceIn && targetIn
    }
    // any-end
    if (!sourceIn && !targetIn) return false
    if (sourceIn && targetIn) return true
    // Un extremo fuera: guardar nodo externo
    if (!sourceIn) {
      const n = allNodesById.get(edge.source)
      if (n) externalNodesById.set(n.id, n)
    }
    if (!targetIn) {
      const n = allNodesById.get(edge.target)
      if (n) externalNodesById.set(n.id, n)
    }
    return true
  })

  const externalEdgeCount = edges.filter(
    (e) => !nodeIds.has(e.source) || !nodeIds.has(e.target),
  ).length

  return {
    topology: { nodes, edges },
    racks: filteredRacks,
    externalNodesById,
    externalEdgeCount,
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
  if (filters.rackIds.length > 0) {
    if (filters.includeUnracked) parts.push('Con equipos del sector')
    else parts.push('Solo racks')
  } else if (!filters.includeUnracked) {
    parts.push('Sin equipos sueltos')
  }
  return parts.join(' · ')
}

/**
 * Cuenta nodos en el resultado filtrado según estén montados en rack o sueltos.
 * Útil para la vista previa del modal de impresión.
 */
export function countPrintScopeNodes(
  nodes: TopologyNode[],
  racks: TopologyRackSummary[],
): { mounted: number; unracked: number } {
  const accessoryToRack = buildAccessoryToRack(racks)
  let mounted = 0
  let unracked = 0
  for (const node of nodes) {
    if (effectiveRackId(node, accessoryToRack)) mounted += 1
    else unracked += 1
  }
  return { mounted, unracked }
}
