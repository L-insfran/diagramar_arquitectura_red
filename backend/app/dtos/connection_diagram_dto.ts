export type DiagramPoint = { x: number; y: number }

export type DiagramEdgeRoute = {
  points: DiagramPoint[]
  /** User-edited orthogonal path; auto-router must not overwrite it. */
  manual?: boolean
}

export type DiagramContainerState = {
  x: number
  y: number
  view?: 'front' | 'rear' | 'both'
  collapsed?: boolean
  /** Device ids visible inside the container on the connection diagram. */
  deviceIds?: string[]
  /** Parent container id (e.g. `area:uuid` for nested rack/board). */
  parentId?: string | null
  /** Manual size for area containers. */
  width?: number
  height?: number
}

export type DiagramSettings = {
  laneSpacing?: number
  snapToGrid?: boolean
  printOrientation?: 'portrait' | 'landscape'
  paperSize?: 'a4' | 'a3'
}

export type CreateConnectionDiagramInput = {
  projectId: string
  name: string
  description?: string | null
  scopeSiteIds?: string[]
  scopeAreaIds?: string[]
  sortOrder?: number
  settings?: DiagramSettings
}

export type UpdateConnectionDiagramInput = {
  name?: string
  description?: string | null
  scopeSiteIds?: string[]
  scopeAreaIds?: string[]
  nodePositions?: Record<string, DiagramPoint>
  labelOffsets?: Record<string, DiagramPoint>
  edgeRoutes?: Record<string, DiagramEdgeRoute>
  containers?: Record<string, DiagramContainerState>
  settings?: DiagramSettings
  sortOrder?: number
}
