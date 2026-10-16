import { areaFlowNodeId } from '../areaPlacement'
import { boardFlowNodeId } from '../boardPlacement'
import { formatLinkCode } from './linkLabel'
import { rackFlowNodeId } from './rackLayout'
import type {
  DiagramLayoutMode,
  DiagramLinkEdge,
  TopologyAreaSummary,
  TopologyBoardSummary,
  TopologyNode,
  TopologyRackSummary,
} from '../../types'

export type DiagramSearchKind = 'device' | 'area' | 'rack' | 'board' | 'link'

export type DiagramSearchItem = {
  id: string
  kind: DiagramSearchKind
  /** Node id on the canvas, or edge id for links. */
  targetId: string
  label: string
  /** Secondary line under the label. */
  subtitle: string
  /** Lowercased, accent-stripped blob used for matching. */
  haystack: string
}

export const DIAGRAM_SEARCH_GROUP_ORDER: DiagramSearchKind[] = [
  'device',
  'area',
  'rack',
  'board',
  'link',
]

export const DIAGRAM_SEARCH_GROUP_LABEL: Record<DiagramSearchKind, string> = {
  device: 'Equipos',
  area: 'Áreas',
  rack: 'Racks',
  board: 'Tableros',
  link: 'Enlaces',
}

/** Lowercase + strip combining marks so "área" matches "area". */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function joinHay(...parts: Array<string | null | undefined>): string {
  return normalizeSearchText(parts.filter(Boolean).join(' '))
}

function deviceSubtitle(
  device: TopologyNode,
  containerLabel: string | undefined
): string {
  const bits: string[] = []
  if (device.data.ipAddress) bits.push(device.data.ipAddress)
  if (containerLabel) bits.push(`en ${containerLabel}`)
  else if (device.data.deviceType) bits.push(device.data.deviceType)
  return bits.join(' · ') || 'Equipo'
}

export function buildDiagramSearchCatalog(params: {
  inventory: TopologyNode[]
  edges: DiagramLinkEdge[]
  areas: TopologyAreaSummary[]
  racks: TopologyRackSummary[]
  boards: TopologyBoardSummary[]
  /** Device ids currently drawn on the canvas. */
  deviceIdsOnCanvas: string[]
  /** Human container label by device id (area / rack / board name). */
  containerByDeviceId: Record<string, string>
  /** Container flow node ids visible on the canvas (area:/rack:/container:). */
  visibleContainerIds: string[]
  layoutMode: DiagramLayoutMode
}): DiagramSearchItem[] {
  const {
    inventory,
    edges,
    areas,
    racks,
    boards,
    deviceIdsOnCanvas,
    containerByDeviceId,
    visibleContainerIds,
    layoutMode,
  } = params

  const items: DiagramSearchItem[] = []
  const onCanvas = new Set(deviceIdsOnCanvas)
  const deviceById = new Map(inventory.map((d) => [d.id, d]))
  const freeMode = layoutMode !== 'tree'
  const visibleContainers = new Set(visibleContainerIds)

  for (const id of deviceIdsOnCanvas) {
    const device = deviceById.get(id)
    if (!device) continue
    const container = containerByDeviceId[id]
    const label = device.label || 'Equipo'
    items.push({
      id: `device:${id}`,
      kind: 'device',
      targetId: id,
      label,
      subtitle: deviceSubtitle(device, container),
      haystack: joinHay(
        label,
        device.data.hostname,
        device.data.ipAddress,
        device.data.deviceType,
        device.data.manufacturer,
        device.data.model,
        device.data.templateName,
        container
      ),
    })
  }

  if (freeMode) {
    for (const area of areas) {
      const nodeId = areaFlowNodeId(area.id)
      if (!visibleContainers.has(nodeId)) continue
      items.push({
        id: `area:${area.id}`,
        kind: 'area',
        targetId: nodeId,
        label: area.name,
        subtitle: area.siteName ? `Área · ${area.siteName}` : 'Área',
        haystack: joinHay(area.name, area.siteName, 'area'),
      })
    }

    for (const rack of racks) {
      const nodeId = rackFlowNodeId(rack.id)
      if (!visibleContainers.has(nodeId)) continue
      items.push({
        id: `rack:${rack.id}`,
        kind: 'rack',
        targetId: nodeId,
        label: rack.name,
        subtitle: [rack.code, rack.areaName].filter(Boolean).join(' · ') || 'Rack',
        haystack: joinHay(rack.name, rack.code, rack.areaName, 'rack'),
      })
    }

    for (const board of boards) {
      const nodeId = boardFlowNodeId(board.id)
      if (!visibleContainers.has(nodeId)) continue
      items.push({
        id: `board:${board.id}`,
        kind: 'board',
        targetId: nodeId,
        label: board.name,
        subtitle: [board.code, board.areaName].filter(Boolean).join(' · ') || 'Tablero',
        haystack: joinHay(board.name, board.code, board.areaName, 'tablero', 'board'),
      })
    }
  }

  for (const edge of edges) {
    if (!onCanvas.has(edge.source) || !onCanvas.has(edge.target)) continue
    const source = deviceById.get(edge.source)
    const target = deviceById.get(edge.target)
    const codeLabel = formatLinkCode(edge.code)
    const sourceName = source?.label ?? edge.sourceLabel
    const targetName = target?.label ?? edge.targetLabel
    const subtitle = `${sourceName} → ${targetName}`
    items.push({
      id: `link:${edge.id}`,
      kind: 'link',
      targetId: edge.id,
      label: codeLabel,
      subtitle: [
        subtitle,
        edge.sourcePort && edge.targetPort
          ? `${edge.sourcePort} ↔ ${edge.targetPort}`
          : null,
        edge.cableTypeName,
        edge.linkTypeName,
      ]
        .filter(Boolean)
        .join(' · '),
      haystack: joinHay(
        codeLabel,
        String(edge.code),
        sourceName,
        targetName,
        edge.sourcePort,
        edge.targetPort,
        edge.cableTypeName,
        edge.linkTypeName,
        edge.description
      ),
    })
  }

  return items
}

export function filterDiagramSearchItems(
  items: DiagramSearchItem[],
  query: string
): DiagramSearchItem[] {
  const q = normalizeSearchText(query)
  if (!q) return []
  return items.filter((item) => item.haystack.includes(q))
}

export function groupDiagramSearchItems(
  items: DiagramSearchItem[]
): Array<{ kind: DiagramSearchKind; label: string; items: DiagramSearchItem[] }> {
  const byKind = new Map<DiagramSearchKind, DiagramSearchItem[]>()
  for (const kind of DIAGRAM_SEARCH_GROUP_ORDER) {
    byKind.set(kind, [])
  }
  for (const item of items) {
    byKind.get(item.kind)?.push(item)
  }
  return DIAGRAM_SEARCH_GROUP_ORDER.map((kind) => ({
    kind,
    label: DIAGRAM_SEARCH_GROUP_LABEL[kind],
    items: byKind.get(kind) ?? [],
  })).filter((g) => g.items.length > 0)
}
