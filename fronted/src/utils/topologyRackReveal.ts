import type { Node } from '@xyflow/react'
import { normalizeRackFace, normalizeRackViewFace } from './topologyRackLayout'

type EdgeEndpoints = {
  source: string
  target: string
}

type DeviceNodeData = {
  rackMounted?: boolean
  rackFace?: string | null
}

type RackNodeData = {
  activeFace?: string
}

/**
 * Racks cuya vista actual oculta algún extremo de los edges dados.
 * El caller debe poner esos racks en vista `both` para que el enlace se vea.
 */
export function racksNeedingBothFacesForEdges(
  nodes: Node[],
  edges: EdgeEndpoints[],
): string[] {
  if (!edges.length) return []

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const rackIds = new Set<string>()

  for (const edge of edges) {
    for (const endpointId of [edge.source, edge.target]) {
      const node = byId.get(endpointId)
      if (!node?.parentId) continue

      const data = node.data as DeviceNodeData
      if (!data.rackMounted) continue

      const rack = byId.get(node.parentId)
      if (!rack) continue

      const activeFace = normalizeRackViewFace((rack.data as RackNodeData).activeFace)
      if (activeFace === 'both') continue

      const deviceFace = normalizeRackFace(data.rackFace)
      if (node.hidden || deviceFace !== activeFace) {
        rackIds.add(node.parentId)
      }
    }
  }

  return [...rackIds]
}
