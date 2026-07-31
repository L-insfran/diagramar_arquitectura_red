import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'
import { TOPOLOGY_NODE_MIN_WIDTH, TOPOLOGY_HEADER_HEIGHT, TOPOLOGY_HEADER_HEIGHT_PATCH, CLOUD_NODE_WIDTH, CLOUD_NODE_HEIGHT, computePortPanelLayout, isCompactPortPanel, isInternetCloudDeviceType, isStructuredCablingDeviceType, partitionDiagramPorts, shouldUseEthernetFaceplateLayout } from './topologyPortPanel'
import type { TopologyPortSummary } from '../types'

/** @deprecated Use TOPOLOGY_NODE_MIN_WIDTH */
export const TOPOLOGY_NODE_WIDTH = TOPOLOGY_NODE_MIN_WIDTH
/** @deprecated Use computeNodeDimensions */
export const TOPOLOGY_NODE_HEIGHT = TOPOLOGY_HEADER_HEIGHT + 16

export type LayoutOptions = {
  direction?: 'TB' | 'LR'
  /** Espaciado amplio y jerarquía clara — ideal para impresión y lectura. */
  printFriendly?: boolean
}

function nodeDimensions(node: Node): { width: number; height: number } {
  const data = node.data as {
    nodeWidth?: number
    nodeHeight?: number
    nodeScale?: number
    ports?: TopologyPortSummary[]
    totalPortCount?: number
    portCount?: number
    deviceType?: string | null
  } | undefined
  if (data?.nodeWidth != null && data?.nodeHeight != null) {
    return { width: data.nodeWidth, height: data.nodeHeight }
  }
  const style = node.style as { width?: number; height?: number } | undefined
  if (typeof style?.width === 'number' && typeof style?.height === 'number') {
    return { width: style.width, height: style.height }
  }
  if (node.type === 'cloud' || isInternetCloudDeviceType(data?.deviceType)) {
    const scale = typeof data?.nodeScale === 'number' && data.nodeScale > 0 ? data.nodeScale : 1
    return { width: Math.round(CLOUD_NODE_WIDTH * scale), height: Math.round(CLOUD_NODE_HEIGHT * scale) }
  }
  const allPorts = Array.isArray(data?.ports) ? data.ports : []
  const { physical, wireless } = partitionDiagramPorts(allPorts)
  const total = data?.totalPortCount ?? data?.portCount ?? allPorts.length
  const totalPhysical = Math.max(0, total - wireless.length)
  const compact = isCompactPortPanel(physical.length, totalPhysical)
  const headerHeight =
    isStructuredCablingDeviceType(data?.deviceType) ||
    shouldUseEthernetFaceplateLayout(data?.deviceType, allPorts)
      ? TOPOLOGY_HEADER_HEIGHT_PATCH
      : TOPOLOGY_HEADER_HEIGHT
  const layout = computePortPanelLayout(
    physical.length,
    compact,
    totalPhysical,
    headerHeight,
    wireless.length,
    { deviceType: data?.deviceType, ports: allPorts },
  )
  const scale = typeof data?.nodeScale === 'number' && data.nodeScale > 0 ? data.nodeScale : 1
  return { width: Math.round(layout.width * scale), height: Math.round(layout.height * scale) }
}

function maxIncidentDegree(edges: Edge[] | null | undefined): number {
  if (!edges?.length) return 0
  const deg = new Map<string, number>()
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) ?? 0) + 1)
    deg.set(e.target, (deg.get(e.target) ?? 0) + 1)
  }
  let m = 0
  for (const v of deg.values()) if (v > m) m = v
  return m
}

function maxNodeWidth(nodes: Node[]): number {
  let m = TOPOLOGY_NODE_MIN_WIDTH
  for (const n of nodes) m = Math.max(m, nodeDimensions(n).width)
  return m
}

function inDegree(nodeId: string, edges: Edge[]): number {
  return edges.filter((e) => e.target === nodeId).length
}

/**
 * Layout jerárquico con Dagre optimizado para diagramas de red legibles e imprimibles.
 * - Flujo top→bottom (ISP arriba, access abajo)
 * - Espaciado generoso entre capas
 * - Nodos ordenados por grado dentro de cada rank
 */
export function layoutTopologyNodes(
  nodes: Node[],
  edges: Edge[] = [],
  options: LayoutOptions = {},
) {
  if (nodes.length === 0) return { nodes, edges: Array.isArray(edges) ? edges : [] }

  const safeEdges = Array.isArray(edges) ? edges : []
  const direction = options.direction ?? 'TB'
  const printFriendly = options.printFriendly !== false
  const maxDeg = maxIncidentDegree(safeEdges)
  const avgHeight =
    nodes.reduce((sum, n) => sum + nodeDimensions(n).height, 0) / Math.max(nodes.length, 1)
  const maxWidth = maxNodeWidth(nodes)

  const ranksep = printFriendly
    ? Math.min(560, Math.max(280, Math.floor(avgHeight * 0.85 + maxDeg * 16 + safeEdges.length * 5)))
    : Math.min(320, 100 + Math.floor(safeEdges.length * 1.2))

  const nodesep = printFriendly
    ? Math.min(440, Math.max(180, Math.floor(maxWidth * 0.2 + maxDeg * 18)))
    : Math.min(240, 72 + Math.floor(maxDeg * 4))

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    ranker: 'network-simplex',
    align: direction === 'TB' ? 'UL' : undefined,
    nodesep,
    ranksep,
    edgesep: printFriendly ? 40 : 20,
    marginx: printFriendly ? 80 : 40,
    marginy: printFriendly ? 80 : 40,
  })

  for (const node of nodes) {
    const { width, height } = nodeDimensions(node)
    g.setNode(node.id, { width, height })
  }

  for (const edge of safeEdges) {
    const srcIn = inDegree(edge.source, safeEdges)
    const tgtIn = inDegree(edge.target, safeEdges)
    const weight = tgtIn >= srcIn ? 1 : 2
    g.setEdge(edge.source, edge.target, { weight, minlen: printFriendly ? (maxDeg > 6 ? 3 : 2) : 1 })
  }

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const { width, height } = nodeDimensions(node)
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - width / 2,
        y: pos.y - height / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges: safeEdges }
}
