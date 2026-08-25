export type DiagramPoint = { x: number; y: number; t?: number; width?: number; height?: number }

export type DiagramHandleSide = 'top' | 'bottom' | 'left' | 'right'

export type DiagramHandleAnchor = {
  side: DiagramHandleSide
  /** 0–1 along the chosen side. */
  t: number
}

export type DiagramLayoutMode = 'free' | 'tree'

export type DiagramPortDisplay = 'all' | 'connected'

export type DiagramEdgeRoute = {
  points: DiagramPoint[]
  /** User-edited orthogonal path; auto-router must not overwrite it. */
  manual?: boolean
}

/** Geometry bucket for one layout mode (free columns or tree_layout JSON). */
export type DiagramLayoutState = {
  nodePositions?: Record<string, DiagramPoint>
  labelOffsets?: Record<string, DiagramPoint>
  edgeRoutes?: Record<string, DiagramEdgeRoute>
  handleAnchors?: Record<string, DiagramHandleAnchor>
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
  /** Content-fit size last persisted; used to preserve user padding when content shrinks. */
  contentMinWidth?: number
  contentMinHeight?: number
}

export type DiagramPrintFrame = {
  x: number
  y: number
  cols: number
  rows: number
  mmPerPx: number
}

export type DiagramSettings = {
  /** Vertical gap between stacked devices inside containers (px). */
  deviceGap?: number
  laneSpacing?: number
  snapToGrid?: boolean
  /** Show all inventory ports vs only ports with diagram links. */
  portDisplay?: DiagramPortDisplay
  /** Swap default source/target sides (free: left/right, tree: bottom/top). */
  portFlowInverted?: boolean
  printOrientation?: 'portrait' | 'landscape'
  paperSize?: 'a4' | 'a3'
  printFrame?: DiagramPrintFrame
  printIncludeLegend?: boolean
  printIncludeLinkTable?: boolean
}

export type CreateConnectionDiagramInput = {
  projectId: string
  name: string
  description?: string | null
  scopeSiteIds?: string[]
  scopeAreaIds?: string[]
  sortOrder?: number
  layoutMode?: DiagramLayoutMode
  settings?: DiagramSettings
}

export type UpdateConnectionDiagramInput = {
  name?: string
  description?: string | null
  scopeSiteIds?: string[]
  scopeAreaIds?: string[]
  /** Free-mode device positions (relative to parent container). */
  nodePositions?: Record<string, DiagramPoint>
  labelOffsets?: Record<string, DiagramPoint>
  edgeRoutes?: Record<string, DiagramEdgeRoute>
  containers?: Record<string, DiagramContainerState>
  handleAnchors?: Record<string, DiagramHandleAnchor>
  /** Tree-mode geometry (absolute canvas coords). Independent of free columns. */
  treeLayout?: DiagramLayoutState
  layoutMode?: DiagramLayoutMode
  settings?: DiagramSettings
  sortOrder?: number
}
