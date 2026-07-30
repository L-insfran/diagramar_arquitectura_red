import type { Node } from '@xyflow/react'
import type { DeviceFlowNodeType } from '../components/topology/DeviceFlowNode'
import type { CloudFlowNodeType } from '../components/topology/CloudFlowNode'
import type { RackFlowNodeType } from '../components/topology/RackFlowNode'
import {
  clampWorkAreaTitleFontSize,
  WORK_AREA_TITLE_FONT_DEFAULT,
  type WorkAreaFlowNodeType,
} from '../components/topology/WorkAreaFlowNode'
import { isRackFlowNodeId } from './topologyRackLayout'

export type TopologyWorkAreaPersist = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  titleFontSize?: number
}

/** Dispositivos del diagrama (tarjeta o nube Internet). */
export type TopologyDeviceNode = DeviceFlowNodeType | CloudFlowNodeType

export type TopologyCanvasNode = TopologyDeviceNode | WorkAreaFlowNodeType | RackFlowNodeType

function isValidWorkAreaPersist(v: unknown): v is TopologyWorkAreaPersist {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
  const o = v as TopologyWorkAreaPersist
  if (
    typeof o.id !== 'string' ||
    typeof o.name !== 'string' ||
    !o.name.trim() ||
    typeof o.x !== 'number' ||
    typeof o.y !== 'number' ||
    typeof o.width !== 'number' ||
    typeof o.height !== 'number' ||
    o.width < 40 ||
    o.height < 40
  ) {
    return false
  }
  if (
    o.titleFontSize !== undefined &&
    (typeof o.titleFontSize !== 'number' || !Number.isFinite(o.titleFontSize))
  ) {
    return false
  }
  return true
}

/** Acepta array, objeto suelto o JSON string y siempre devuelve un array válido. */
export function coerceWorkAreasArray(value: unknown): TopologyWorkAreaPersist[] {
  let raw = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw) as unknown
    } catch {
      return []
    }
  }
  if (raw == null) return []
  if (Array.isArray(raw)) return raw.filter(isValidWorkAreaPersist)
  if (isValidWorkAreaPersist(raw)) return [raw]
  return []
}

export function isWorkAreaNode(node: Node): node is WorkAreaFlowNodeType {
  return node.type === 'workArea'
}

export function isRackNode(node: Node): node is RackFlowNodeType {
  return node.type === 'rack'
}

export function isDeviceNode(node: Node): node is TopologyDeviceNode {
  return node.type === 'device' || node.type === 'cloud' || node.type == null
}

export function absoluteNodePosition(
  node: Node,
  byId: Map<string, Node>,
): { x: number; y: number } {
  const maybeAbs = (node as Node & { positionAbsolute?: { x: number; y: number } }).positionAbsolute
  if (maybeAbs) {
    return { x: maybeAbs.x, y: maybeAbs.y }
  }
  let x = node.position.x
  let y = node.position.y
  let parentId = node.parentId
  const seen = new Set<string>()
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    x += parent.position.x
    y += parent.position.y
    parentId = parent.parentId
  }
  return { x, y }
}

/** React Flow a veces reporta measured.width/height = 0 antes de medir; 0 no debe ganar al fallback. */
function positiveDimension(...candidates: Array<number | undefined>): number | undefined {
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  }
  return undefined
}

export function nodeSize(node: Node): { width: number; height: number } {
  const styleWidth = typeof node.style?.width === 'number' ? node.style.width : undefined
  const styleHeight = typeof node.style?.height === 'number' ? node.style.height : undefined
  const width = positiveDimension(node.measured?.width, node.width, styleWidth) ?? 160
  const height = positiveDimension(node.measured?.height, node.height, styleHeight) ?? 80
  return { width, height }
}

export function createWorkAreaNode(area: TopologyWorkAreaPersist): WorkAreaFlowNodeType {
  return {
    id: area.id,
    type: 'workArea',
    position: { x: area.x, y: area.y },
    data: {
      name: area.name,
      titleFontSize: clampWorkAreaTitleFontSize(area.titleFontSize ?? WORK_AREA_TITLE_FONT_DEFAULT),
    },
    style: { width: area.width, height: area.height },
    width: area.width,
    height: area.height,
    zIndex: -1,
    selectable: true,
    draggable: true,
  }
}

const MIN_WORK_AREA_SIZE = 40

function finiteCoord(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function snapshotWorkAreas(nodes: readonly Node[]): TopologyWorkAreaPersist[] {
  return nodes.filter(isWorkAreaNode).map((n) => {
    const { width, height } = nodeSize(n)
    const name = (n.data.name ?? '').trim() || 'ÁREA'
    return {
      id: n.id,
      name: name.slice(0, 120),
      x: finiteCoord(n.position.x),
      y: finiteCoord(n.position.y),
      width: Math.max(MIN_WORK_AREA_SIZE, width),
      height: Math.max(MIN_WORK_AREA_SIZE, height),
      titleFontSize: clampWorkAreaTitleFontSize(n.data.titleFontSize ?? WORK_AREA_TITLE_FONT_DEFAULT),
    }
  })
}

export function snapshotDevicePositions(nodes: readonly Node[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) {
    if (isWorkAreaNode(n)) continue
    // Posiciones U de equipos montados se recalculan desde dominio; no persistir relativas.
    if (isDeviceNode(n) && n.parentId && isRackFlowNodeId(n.parentId)) continue
    const x = finiteCoord(n.position.x, Number.NaN)
    const y = finiteCoord(n.position.y, Number.NaN)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    out[n.id] = { x, y }
  }
  return out
}

export function snapshotNodeParents(nodes: readonly Node[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of nodes) {
    if (isWorkAreaNode(n) || isRackNode(n) || !n.parentId) continue
    // Jerarquía rack←device es de dominio, no de work areas.
    if (isRackFlowNodeId(n.parentId)) continue
    out[n.id] = n.parentId
  }
  return out
}

/** Antepone nodos área y asigna parentId. Las posiciones de dispositivos deben
 *  estar ya en coords relativas si tienen padre (tal como se persistieron).
 *  No toca hijos de rack (parentId rack:*). */
export function applyWorkAreaHierarchy(
  devices: TopologyDeviceNode[],
  workAreas: unknown,
  parents: Readonly<Record<string, string>>,
): TopologyCanvasNode[] {
  const normalizedAreas = coerceWorkAreasArray(workAreas)
  const areaNodes = normalizedAreas.map(createWorkAreaNode)
  const areaIds = new Set(areaNodes.map((a) => a.id))

  // No usar extent:'parent': bloquearía sacar el dispositivo del área al arrastrar.
  const nextDevices: TopologyDeviceNode[] = devices.map((device) => {
    if (device.parentId && isRackFlowNodeId(device.parentId)) {
      return device
    }
    const parentId = parents[device.id]
    if (!parentId || !areaIds.has(parentId)) {
      return { ...device, parentId: undefined, extent: undefined }
    }
    return { ...device, parentId, extent: undefined }
  })

  return [...areaNodes, ...nextDevices]
}

/**
 * Tras soltar un dispositivo: si su centro cae dentro de un área, lo anida;
 * si no, lo desanida. Las áreas se mueven con sus hijos (React Flow).
 * Equipos montados en rack no se reparentan a work areas.
 */
export function reparentDevicesAfterDrag(nodes: TopologyCanvasNode[]): TopologyCanvasNode[] {
  const byId = new Map<string, Node>(nodes.map((n) => [n.id, n]))
  const areas = nodes.filter(isWorkAreaNode)

  return nodes.map((node) => {
    if (isWorkAreaNode(node) || isRackNode(node)) return node
    if (node.parentId && isRackFlowNodeId(node.parentId)) return node

    const abs = absoluteNodePosition(node, byId)
    const { width, height } = nodeSize(node)
    const cx = abs.x + width / 2
    const cy = abs.y + height / 2

    let containing: WorkAreaFlowNodeType | null = null
    for (const area of areas) {
      const { width: aw, height: ah } = nodeSize(area)
      if (cx >= area.position.x && cx <= area.position.x + aw && cy >= area.position.y && cy <= area.position.y + ah) {
        containing = area
        break
      }
    }

    if (containing) {
      if (node.parentId === containing.id) {
        return node.extent === undefined ? node : { ...node, extent: undefined }
      }
      return {
        ...node,
        parentId: containing.id,
        extent: undefined,
        position: {
          x: abs.x - containing.position.x,
          y: abs.y - containing.position.y,
        },
      }
    }

    if (!node.parentId) return node
    return {
      ...node,
      parentId: undefined,
      extent: undefined,
      position: abs,
    }
  })
}

export function detachChildrenFromWorkArea(
  nodes: TopologyCanvasNode[],
  areaId: string,
): TopologyCanvasNode[] {
  const byId = new Map<string, Node>(nodes.map((n) => [n.id, n]))
  return nodes
    .filter((n) => n.id !== areaId)
    .map((node) => {
      if (node.parentId !== areaId) return node
      const abs = absoluteNodePosition(node, byId)
      return { ...node, parentId: undefined, extent: undefined, position: abs }
    })
}

export function newWorkAreaId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `wa-${crypto.randomUUID()}`
  return `wa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
