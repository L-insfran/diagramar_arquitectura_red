import type { Node } from '@xyflow/react'
import type { DeviceFlowNodeType } from '../components/topology/DeviceFlowNode'
import {
  clampWorkAreaTitleFontSize,
  WORK_AREA_TITLE_FONT_DEFAULT,
  type WorkAreaFlowNodeType,
} from '../components/topology/WorkAreaFlowNode'

export type TopologyWorkAreaPersist = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  titleFontSize?: number
}

export type TopologyCanvasNode = DeviceFlowNodeType | WorkAreaFlowNodeType

export function isWorkAreaNode(node: Node): node is WorkAreaFlowNodeType {
  return node.type === 'workArea'
}

export function isDeviceNode(node: Node): node is DeviceFlowNodeType {
  return node.type === 'device' || node.type == null
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
    if (isWorkAreaNode(n) || !n.parentId) continue
    out[n.id] = n.parentId
  }
  return out
}

/** Antepone nodos área y asigna parentId. Las posiciones de dispositivos deben
 *  estar ya en coords relativas si tienen padre (tal como se persistieron). */
export function applyWorkAreaHierarchy(
  devices: DeviceFlowNodeType[],
  workAreas: TopologyWorkAreaPersist[],
  parents: Readonly<Record<string, string>>,
): TopologyCanvasNode[] {
  const areaNodes = workAreas.map(createWorkAreaNode)
  const areaIds = new Set(areaNodes.map((a) => a.id))

  const nextDevices: DeviceFlowNodeType[] = devices.map((device) => {
    const parentId = parents[device.id]
    if (!parentId || !areaIds.has(parentId)) {
      return { ...device, parentId: undefined, extent: undefined }
    }
    return { ...device, parentId, extent: 'parent' as const }
  })

  return [...areaNodes, ...nextDevices]
}

/**
 * Tras soltar un dispositivo: si su centro cae dentro de un área, lo anida;
 * si no, lo desanida. Las áreas se mueven con sus hijos (React Flow).
 */
export function reparentDevicesAfterDrag(nodes: TopologyCanvasNode[]): TopologyCanvasNode[] {
  const byId = new Map<string, Node>(nodes.map((n) => [n.id, n]))
  const areas = nodes.filter(isWorkAreaNode)

  return nodes.map((node) => {
    if (isWorkAreaNode(node)) return node

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
      if (node.parentId === containing.id) return node
      return {
        ...node,
        parentId: containing.id,
        extent: 'parent' as const,
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
