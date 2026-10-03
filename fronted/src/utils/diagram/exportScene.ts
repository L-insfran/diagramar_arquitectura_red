/**
 * Neutral geometry of the connection diagram, taken from the live React Flow
 * state. Free and tree layouts both land here: the canvas already resolved
 * which geometry is on screen.
 */
import type { Node } from '@xyflow/react'
import type { Edge } from '@xyflow/react'
import type {
  DiagramHandleAnchor,
  DiagramHandleSide,
  DiagramLayoutMode,
  MediumType,
  TopologyAreaSummary,
  TopologyBoardSummary,
  TopologyRackSummary,
} from '../../types'
import { MEDIUM_EDGE_STYLES } from '../../types'
import type { RoutedLinkEdgeData } from '../../components/diagram/RoutedLinkEdge'
import { SIMPLE_DEVICE_WIDTH, devicePortAreaTop, simpleDeviceHeight } from '../../components/diagram/SimpleDeviceNode'
import { DIAGRAM_CONNECT_SOURCE_HANDLE, DIAGRAM_CONNECT_TARGET_HANDLE } from './diagramPortHandles'
import {
  legacyToNeutralHandleId,
  portSlotsVerticalRows,
  type DiagramPortSlot,
} from './devicePortSlots'
import { anchorToEndpoint, defaultHandleAnchor } from './handleAnchor'
import { formatLinkCode } from './linkLabel'
import {
  closestPointOnPath,
  defaultLabelPathT,
  pathLabelAnchor,
  pointAtPathT,
  type DiagramPoint,
} from './orthogonalPath'
import { reattachOrthogonalEnds } from './orthogonalRouteEdit'
import { repairManualRoute } from './routeTransform'

export type ExportRect = { x: number; y: number; width: number; height: number }

export type ExportBounds = { minX: number; minY: number; maxX: number; maxY: number }

export type ExportContainerKind = 'area' | 'rack' | 'board'

export type ExportContainer = {
  id: string
  kind: ExportContainerKind
  name: string
  code: string | null
  rect: ExportRect
}

export type ExportPort = {
  label: string
  x: number
  y: number
  side: DiagramHandleSide
  connected: boolean
}

export type ExportDevice = {
  id: string
  name: string
  ipAddress: string | null
  deviceType: string | null
  accentColor: string
  rect: ExportRect
  ports: ExportPort[]
}

export type ExportLink = {
  id: string
  code: string
  points: DiagramPoint[]
  medium: MediumType
  color: string
  /** CSS dash pattern from the canvas stroke, when the medium is not solid. */
  strokeDasharray: string | null
  label: { x: number; y: number }
  sourcePort: string
  targetPort: string
}

export type DiagramExportScene = {
  layoutMode: DiagramLayoutMode
  bounds: ExportBounds
  containers: ExportContainer[]
  devices: ExportDevice[]
  links: ExportLink[]
}

type FlowNode = Node
type FlowEdge = Edge<RoutedLinkEdgeData>

function absolutePosition(nodes: FlowNode[], id: string): { x: number; y: number } | null {
  const node = nodes.find((n) => n.id === id)
  if (!node) return null
  if (!node.parentId) return { x: node.position.x, y: node.position.y }
  const parent = absolutePosition(nodes, node.parentId)
  if (!parent) return { x: node.position.x, y: node.position.y }
  return { x: parent.x + node.position.x, y: parent.y + node.position.y }
}

function nodeSize(node: FlowNode): { width: number; height: number } {
  const measured = node.measured
  const width = Number(measured?.width ?? node.width ?? node.style?.width ?? 0)
  const height = Number(measured?.height ?? node.height ?? node.style?.height ?? 0)
  return {
    width: Number.isFinite(width) && width > 0 ? width : 0,
    height: Number.isFinite(height) && height > 0 ? height : 0,
  }
}

/**
 * Device box used by the orthogonal router (`resolveNodeHandleEndpoint`).
 * Measured size wins, but never smaller than the port-row content height.
 */
function deviceBox(node: FlowNode): { width: number; height: number } {
  const size = nodeSize(node)
  const slots = (node.data?.slots as DiagramPortSlot[] | undefined) ?? []
  const label = typeof node.data?.label === 'string' ? node.data.label : ''
  const width = size.width > 0 ? size.width : SIMPLE_DEVICE_WIDTH
  const rows = portSlotsVerticalRows(slots)
  const compact = slots.length > 0 && slots.every((s) => !s.connected)
  const contentMinH = simpleDeviceHeight(rows, label, width, compact)
  const height = size.height > 0 ? Math.max(size.height, contentMinH) : contentMinH
  return { width, height }
}

function handleEndpoint(
  node: FlowNode,
  handleId: string,
  role: 'source' | 'target',
  abs: { x: number; y: number },
): { x: number; y: number; side: DiagramHandleSide } {
  const neutralId = legacyToNeutralHandleId(handleId.replace(/::in$/, ''))
  const box = deviceBox(node)
  const slots = (node.data?.slots as DiagramPortSlot[] | undefined) ?? []
  const slot = slots.find((s) => s.id === neutralId)
  if (slot?.anchor) {
    return anchorToEndpoint(slot.anchor, abs.x, abs.y, box.width, box.height)
  }

  const label = typeof node.data?.label === 'string' ? node.data.label : ''
  const portCount = typeof node.data?.portCount === 'number' ? node.data.portCount : 0
  const rows = portSlotsVerticalRows(slots)
  const portAreaTop = devicePortAreaTop(label, rows, portCount, box.width)
  const nodeAnchors =
    (node.data?.handleAnchors as Record<string, DiagramHandleAnchor> | undefined) ?? {}
  const idx = slots.findIndex((s) => s.id === neutralId)
  const anchor =
    nodeAnchors[neutralId] ??
    (idx >= 0
      ? defaultHandleAnchor(role, idx, Math.max(1, slots.length), box.height, portAreaTop)
      : {
          side: role === 'target' ? ('left' as const) : ('right' as const),
          t: 0.5,
        })
  return anchorToEndpoint(anchor, abs.x, abs.y, box.width, box.height)
}

function linkPolyline(
  data: RoutedLinkEdgeData | undefined,
  source: DiagramPoint,
  target: DiagramPoint,
): DiagramPoint[] {
  const route = data?.routePoints
  if (route && route.length >= 2) {
    return data?.routeManual
      ? repairManualRoute(route, source, target)
      : reattachOrthogonalEnds(route, source, target)
  }
  const midY = (source.y + target.y) / 2
  return [source, { x: source.x, y: midY }, { x: target.x, y: midY }, target]
}

function labelPoint(data: RoutedLinkEdgeData | undefined, points: DiagramPoint[]): DiagramPoint {
  let t: number
  if (data?.labelPathT != null && Number.isFinite(data.labelPathT)) {
    t = Math.min(1, Math.max(0, data.labelPathT))
  } else {
    const anchor = pathLabelAnchor(points)
    if (data?.labelOffsetX || data?.labelOffsetY) {
      t = closestPointOnPath(points, {
        x: anchor.x + (data.labelOffsetX ?? 0),
        y: anchor.y + (data.labelOffsetY ?? 0),
      }).t
    } else {
      t = defaultLabelPathT(points)
    }
  }
  return pointAtPathT(points, t)
}

function includePoint(bounds: ExportBounds, x: number, y: number) {
  bounds.minX = Math.min(bounds.minX, x)
  bounds.minY = Math.min(bounds.minY, y)
  bounds.maxX = Math.max(bounds.maxX, x)
  bounds.maxY = Math.max(bounds.maxY, y)
}

function includeRect(bounds: ExportBounds, rect: ExportRect) {
  includePoint(bounds, rect.x, rect.y)
  includePoint(bounds, rect.x + rect.width, rect.y + rect.height)
}

function containerOf(node: FlowNode): ExportContainer | null {
  const size = nodeSize(node)
  if (size.width <= 0 || size.height <= 0) return null
  if (node.type === 'areaContainer') {
    const area = node.data?.area as TopologyAreaSummary | undefined
    return {
      id: node.id,
      kind: 'area',
      name: area?.name?.trim() || 'Área',
      code: null,
      rect: { x: 0, y: 0, width: size.width, height: size.height },
    }
  }
  if (node.type === 'rackContainer') {
    const rack = node.data?.rack as TopologyRackSummary | undefined
    return {
      id: node.id,
      kind: 'rack',
      name: rack?.name?.trim() || 'Rack',
      code: rack?.code?.trim() || null,
      rect: { x: 0, y: 0, width: size.width, height: size.height },
    }
  }
  if (node.type === 'boardContainer') {
    const board = node.data?.board as TopologyBoardSummary | undefined
    return {
      id: node.id,
      kind: 'board',
      name: board?.name?.trim() || 'Tablero',
      code: board?.code?.trim() || null,
      rect: { x: 0, y: 0, width: size.width, height: size.height },
    }
  }
  return null
}

/**
 * Build the export scene from the nodes and edges currently on the canvas.
 * Positions follow the same parent walk the cable router uses, so the DXF
 * matches the view (free containers or flat tree).
 */
export function buildExportScene(
  nodes: FlowNode[],
  edges: FlowEdge[],
  layoutMode: DiagramLayoutMode,
): DiagramExportScene | null {
  const visible = nodes.filter((n) => n.hidden !== true)
  const containers: ExportContainer[] = []
  const devices: ExportDevice[] = []

  for (const node of visible) {
    const abs = absolutePosition(visible, node.id)
    if (!abs) continue

    const container = containerOf(node)
    if (container) {
      container.rect = { ...container.rect, x: abs.x, y: abs.y }
      containers.push(container)
      continue
    }

    if (node.type !== 'simpleDevice') continue
    const box = deviceBox(node)
    const slots = (node.data?.slots as DiagramPortSlot[] | undefined) ?? []
    const ports: ExportPort[] = slots.map((slot) => {
      const at = anchorToEndpoint(slot.anchor, abs.x, abs.y, box.width, box.height)
      return {
        label: slot.label,
        x: at.x,
        y: at.y,
        side: at.side,
        connected: slot.connected,
      }
    })
    const ip = node.data?.ipAddress
    const deviceType = node.data?.deviceType
    devices.push({
      id: node.id,
      name: typeof node.data?.label === 'string' && node.data.label.trim() ? node.data.label.trim() : 'Equipo',
      ipAddress: typeof ip === 'string' && ip.trim() ? ip.trim() : null,
      deviceType: typeof deviceType === 'string' && deviceType.trim() ? deviceType.trim() : null,
      accentColor:
        typeof node.data?.accentColor === 'string' && node.data.accentColor
          ? node.data.accentColor
          : '#64748b',
      rect: { x: abs.x, y: abs.y, width: box.width, height: box.height },
      ports,
    })
  }

  if (containers.length === 0 && devices.length === 0) return null

  const deviceById = new Map(devices.map((d) => [d.id, d]))
  const nodeById = new Map(visible.map((n) => [n.id, n]))
  const links: ExportLink[] = []

  for (const edge of edges) {
    if (edge.hidden) continue
    if (!deviceById.has(edge.source) || !deviceById.has(edge.target)) continue
    const sourceNode = nodeById.get(edge.source)
    const targetNode = nodeById.get(edge.target)
    const sourceAbs = absolutePosition(visible, edge.source)
    const targetAbs = absolutePosition(visible, edge.target)
    if (!sourceNode || !targetNode || !sourceAbs || !targetAbs) continue

    const sourceEp = handleEndpoint(
      sourceNode,
      edge.sourceHandle ?? DIAGRAM_CONNECT_SOURCE_HANDLE,
      'source',
      sourceAbs,
    )
    const targetEp = handleEndpoint(
      targetNode,
      edge.targetHandle ?? DIAGRAM_CONNECT_TARGET_HANDLE,
      'target',
      targetAbs,
    )
    const points = linkPolyline(edge.data, sourceEp, targetEp)
    if (points.length < 2) continue

    const medium = (edge.data?.medium?.mediumType ?? 'utp') as MediumType
    const style = MEDIUM_EDGE_STYLES[medium] ?? MEDIUM_EDGE_STYLES.utp
    const code =
      edge.data?.code != null ? formatLinkCode(edge.data.code) : formatLinkCode(null)

    links.push({
      id: edge.id,
      code,
      points,
      medium,
      color: style.stroke,
      strokeDasharray: style.strokeDasharray ?? null,
      label: labelPoint(edge.data, points),
      sourcePort: edge.data?.sourcePort?.trim() || '',
      targetPort: edge.data?.targetPort?.trim() || '',
    })
  }

  const bounds: ExportBounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  }
  for (const container of containers) includeRect(bounds, container.rect)
  for (const device of devices) {
    includeRect(bounds, device.rect)
    for (const port of device.ports) includePoint(bounds, port.x, port.y)
  }
  for (const link of links) {
    for (const point of link.points) includePoint(bounds, point.x, point.y)
    includePoint(bounds, link.label.x, link.label.y)
  }

  return { layoutMode, bounds, containers, devices, links }
}
