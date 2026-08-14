import type { DiagramLinkEdge, TopologyNode } from '../../types'
import { formatLinkCode, formatLinkReference } from './linkLabel'

export type DiagramLinkReferenceFilters = {
  query: string
  sourceDeviceId: string
  targetDeviceId: string
  container: string
}

export const EMPTY_LINK_REFERENCE_FILTERS: DiagramLinkReferenceFilters = {
  query: '',
  sourceDeviceId: '',
  targetDeviceId: '',
  container: '',
}

export function hasActiveLinkReferenceFilters(filters: DiagramLinkReferenceFilters): boolean {
  return Boolean(
    filters.query.trim() ||
      filters.sourceDeviceId ||
      filters.targetDeviceId ||
      filters.container
  )
}

function deviceSearchText(device: TopologyNode | undefined): string {
  if (!device) return ''
  return [device.label, device.data.hostname, device.data.ipAddress, device.data.location]
    .filter(Boolean)
    .join(' ')
}

export function filterDiagramLinkReferences(
  edges: DiagramLinkEdge[],
  inventory: TopologyNode[],
  containerByDeviceId: Record<string, string>,
  filters: DiagramLinkReferenceFilters
): DiagramLinkEdge[] {
  const tokens = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const byId = new Map(inventory.map((d) => [d.id, d]))

  return edges.filter((edge) => {
    if (filters.sourceDeviceId && edge.source !== filters.sourceDeviceId) return false
    if (filters.targetDeviceId && edge.target !== filters.targetDeviceId) return false
    if (filters.container) {
      const sourceContainer = containerByDeviceId[edge.source]
      const targetContainer = containerByDeviceId[edge.target]
      if (sourceContainer !== filters.container && targetContainer !== filters.container) {
        return false
      }
    }
    if (!tokens.length) return true

    const haystack = [
      formatLinkCode(edge.code),
      String(edge.code ?? ''),
      edge.sourceLabel,
      edge.targetLabel,
      edge.sourcePort,
      edge.targetPort,
      edge.description ?? '',
      containerByDeviceId[edge.source] ?? '',
      containerByDeviceId[edge.target] ?? '',
      deviceSearchText(byId.get(edge.source)),
      deviceSearchText(byId.get(edge.target)),
      formatLinkReference(edge, inventory, containerByDeviceId),
    ]
      .join(' ')
      .toLowerCase()

    return tokens.every((token) => haystack.includes(token))
  })
}
