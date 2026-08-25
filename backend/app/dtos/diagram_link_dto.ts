export type CreateDiagramLinkInput = {
  projectId: string
  sourceDeviceId: string
  targetDeviceId: string
  sourcePortId?: string | null
  targetPortId?: string | null
  sourcePortLabel: string
  targetPortLabel: string
  description?: string | null
  cableTypeId?: string | null
}

export type UpdateDiagramLinkInput = {
  sourceDeviceId?: string
  targetDeviceId?: string
  sourcePortId?: string | null
  targetPortId?: string | null
  sourcePortLabel?: string
  targetPortLabel?: string
  description?: string | null
  cableTypeId?: string | null
}

/** Edge shape returned by connection-diagram graph for simplified links. */
export type DiagramLinkEdge = {
  id: string
  code: number
  source: string
  target: string
  sourcePort: string
  targetPort: string
  sourcePortId: string | null
  targetPortId: string | null
  sourceLabel: string
  targetLabel: string
  description: string | null
  cableTypeId: string | null
  cableTypeName: string | null
}
