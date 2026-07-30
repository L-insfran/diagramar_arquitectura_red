import type { Node } from '@xyflow/react'
import type { DeviceNodeData } from '../components/topology/DeviceFlowNode'
import type { TopologyDeviceNode } from './topologyWorkAreas'
import {
  CLOUD_NODE_HEIGHT,
  CLOUD_NODE_WIDTH,
  TOPOLOGY_HEADER_HEIGHT,
  TOPOLOGY_HEADER_HEIGHT_PATCH,
  computePortPanelLayout,
  isCompactPortPanel,
  isInternetCloudDeviceType,
  isStructuredCablingDeviceType,
  partitionDiagramPorts,
} from './topologyPortPanel'

/** Escala visual de nodos de dispositivo / nube en el diagrama. */
export const NODE_SCALE_MIN = 0.5
export const NODE_SCALE_MAX = 2.5
/** La nube puede crecer más que un equipo típico. */
export const CLOUD_NODE_SCALE_MAX = 6
export const NODE_SCALE_DEFAULT = 1

export function clampNodeScale(value: number, max: number = NODE_SCALE_MAX): number {
  if (!Number.isFinite(value) || value <= 0) return NODE_SCALE_DEFAULT
  const upper = Number.isFinite(max) && max > NODE_SCALE_MIN ? max : NODE_SCALE_MAX
  return Math.min(upper, Math.max(NODE_SCALE_MIN, value))
}

export function scaleMaxForNode(node: Pick<TopologyDeviceNode, 'type' | 'data'>): number {
  if (node.type === 'cloud' || isInternetCloudDeviceType(node.data.deviceType)) {
    return CLOUD_NODE_SCALE_MAX
  }
  return NODE_SCALE_MAX
}

export function scaledNodeDimensions(
  baseWidth: number,
  baseHeight: number,
  scale: number,
  maxScale: number = NODE_SCALE_MAX,
): { width: number; height: number; scale: number } {
  const s = clampNodeScale(scale, maxScale)
  return {
    width: Math.max(1, Math.round(baseWidth * s)),
    height: Math.max(1, Math.round(baseHeight * s)),
    scale: s,
  }
}

function positiveDimension(...candidates: Array<number | undefined>): number | undefined {
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  }
  return undefined
}

function readNodeWidth(node: Node): number {
  const styleWidth = typeof node.style?.width === 'number' ? node.style.width : undefined
  return positiveDimension(node.measured?.width, node.width, styleWidth) ?? 160
}

/** Tamaño natural (escala 1) según puertos / tipo de nodo. */
export function naturalDeviceNodeSize(node: TopologyDeviceNode): { width: number; height: number } {
  if (node.type === 'cloud' || isInternetCloudDeviceType(node.data.deviceType)) {
    return { width: CLOUD_NODE_WIDTH, height: CLOUD_NODE_HEIGHT }
  }
  const allPorts = node.data.ports ?? []
  const { physical, wireless } = partitionDiagramPorts(allPorts)
  const total = node.data.totalPortCount ?? node.data.portCount ?? allPorts.length
  const totalPhysical = Math.max(0, total - wireless.length)
  const compact = isCompactPortPanel(physical.length, totalPhysical)
  const headerHeight = isStructuredCablingDeviceType(node.data.deviceType)
    ? TOPOLOGY_HEADER_HEIGHT_PATCH
    : TOPOLOGY_HEADER_HEIGHT
  const layout = computePortPanelLayout(
    physical.length,
    compact,
    totalPhysical,
    headerHeight,
    wireless.length,
  )
  return { width: layout.width, height: layout.height }
}

export function applyDeviceNodeScale(
  node: TopologyDeviceNode,
  scale: number,
): TopologyDeviceNode {
  const base = naturalDeviceNodeSize(node)
  const dims = scaledNodeDimensions(base.width, base.height, scale, scaleMaxForNode(node))
  return {
    ...node,
    width: dims.width,
    height: dims.height,
    style: { ...(node.style ?? {}), width: dims.width, height: dims.height },
    data: {
      ...node.data,
      nodeScale: dims.scale,
      nodeWidth: dims.width,
      nodeHeight: dims.height,
    },
  }
}

export function mergePersistedNodeScales(
  nodes: TopologyDeviceNode[],
  scales: Readonly<Record<string, number>>,
): TopologyDeviceNode[] {
  return nodes.map((n) => {
    const raw = scales[n.id]
    if (raw == null) return n
    return applyDeviceNodeScale(n, raw)
  })
}

export function snapshotDeviceScales(nodes: readonly Node[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const n of nodes) {
    if (n.type !== 'device' && n.type !== 'cloud') continue
    const device = n as TopologyDeviceNode
    const data = device.data as DeviceNodeData
    let scale = data.nodeScale
    if (typeof scale !== 'number' || !Number.isFinite(scale)) {
      const base = naturalDeviceNodeSize(device)
      scale = readNodeWidth(device) / Math.max(1, base.width)
    }
    const s = clampNodeScale(scale, scaleMaxForNode(device))
    if (Math.abs(s - NODE_SCALE_DEFAULT) < 0.01) continue
    out[n.id] = Math.round(s * 1000) / 1000
  }
  return out
}

/**
 * Tras un resize: actualiza data.nodeScale / width de dispositivos
 * y deja el resto de nodos (p. ej. áreas) intactos.
 */
export function withSyncedDeviceNodeScales(nodes: readonly Node[]): Node[] {
  return nodes.map((n) => {
    if (n.type !== 'device' && n.type !== 'cloud') return n
    const device = n as TopologyDeviceNode
    const base = naturalDeviceNodeSize(device)
    return applyDeviceNodeScale(device, readNodeWidth(device) / Math.max(1, base.width))
  })
}
