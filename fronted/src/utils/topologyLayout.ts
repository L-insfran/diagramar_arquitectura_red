import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'

/** Keep in sync with `DeviceFlowNode` fixed size and React Flow `node.style`. */
export const TOPOLOGY_NODE_WIDTH = 300
export const TOPOLOGY_NODE_HEIGHT = 158

const NODE_WIDTH = TOPOLOGY_NODE_WIDTH
const NODE_HEIGHT = TOPOLOGY_NODE_HEIGHT

function maxIncidentDegree(edges: Edge[]): number {
  const deg = new Map<string, number>()
  for (const e of edges) {
    deg.set(e.source, (deg.get(e.source) ?? 0) + 1)
    deg.set(e.target, (deg.get(e.target) ?? 0) + 1)
  }
  let m = 0
  for (const v of deg.values()) if (v > m) m = v
  return m
}

/**
 * Assigns positions to React Flow nodes using Dagre (layered directed layout).
 * Separa más capas y nodos cuando hay muchas conexiones para reducir cruces y solapes.
 */
export function layoutTopologyNodes(nodes: Node[], edges: Edge[], direction: 'TB' | 'LR' = 'TB') {
  if (nodes.length === 0) {
    return { nodes, edges }
  }

  const maxDeg = maxIncidentDegree(edges)
  const edgeBoost = Math.min(140, Math.floor(edges.length * 1.2))
  const fanBoost = Math.min(100, Math.max(0, maxDeg - 4) * 8)
  const ranksep = Math.min(280, 100 + edgeBoost + fanBoost + Math.floor(NODE_HEIGHT * 0.15))
  const nodesep = Math.min(220, 64 + Math.floor(maxDeg * 4))

  const g = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, ranksep, nodesep, marginx: 40, marginy: 40 })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id)
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges }
}
