export function areaFlowNodeId(areaId: string): string {
  return `area:${areaId}`
}

export function parseAreaFlowNodeId(nodeId: string): string | null {
  if (!nodeId.startsWith('area:')) return null
  return nodeId.slice(5) || null
}
