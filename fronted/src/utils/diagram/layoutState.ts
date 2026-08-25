import type {
  ConnectionDiagram,
  DiagramLayoutMode,
  DiagramLayoutState,
  DiagramNodePosition,
} from '../../types'
import type { UpdateConnectionDiagramPayload } from '../../services/connection-diagrams.service'

function isTreeMode(mode: DiagramLayoutMode | undefined): boolean {
  return mode === 'tree'
}

/** True when the tree bucket has at least one saved device position. */
export function hasTreeLayoutPositions(
  treeLayout: DiagramLayoutState | null | undefined
): boolean {
  const positions = treeLayout?.nodePositions
  if (!positions) return false
  return Object.keys(positions).length > 0
}

/**
 * Resolve the geometry bucket for the active layout mode.
 * Free mode → root columns; tree mode → `treeLayout`.
 */
export function resolveActiveLayoutState(
  diagram: Pick<
    ConnectionDiagram,
    | 'layoutMode'
    | 'nodePositions'
    | 'labelOffsets'
    | 'edgeRoutes'
    | 'handleAnchors'
    | 'treeLayout'
  >
): DiagramLayoutState {
  if (isTreeMode(diagram.layoutMode)) {
    const tree = diagram.treeLayout ?? {}
    return {
      nodePositions: tree.nodePositions ?? {},
      labelOffsets: tree.labelOffsets ?? {},
      edgeRoutes: tree.edgeRoutes ?? {},
      handleAnchors: tree.handleAnchors ?? {},
    }
  }
  return {
    nodePositions: diagram.nodePositions ?? {},
    labelOffsets: diagram.labelOffsets ?? {},
    edgeRoutes: diagram.edgeRoutes ?? {},
    handleAnchors: diagram.handleAnchors ?? {},
  }
}

/**
 * Build a PUT payload that writes geometry into the correct bucket for `mode`.
 * Free → root columns; tree → `treeLayout`.
 */
export function buildLayoutUpdate(
  mode: DiagramLayoutMode,
  state: DiagramLayoutState
): UpdateConnectionDiagramPayload {
  if (isTreeMode(mode)) {
    return {
      treeLayout: {
        nodePositions: state.nodePositions ?? {},
        labelOffsets: state.labelOffsets ?? {},
        edgeRoutes: state.edgeRoutes ?? {},
        handleAnchors: state.handleAnchors ?? {},
      },
    }
  }
  return {
    nodePositions: state.nodePositions ?? {},
    labelOffsets: state.labelOffsets ?? {},
    edgeRoutes: state.edgeRoutes ?? {},
    handleAnchors: state.handleAnchors ?? {},
  }
}

/** Free-mode geometry from root columns (ignores layoutMode). */
export function resolveFreeLayoutState(
  diagram: Pick<
    ConnectionDiagram,
    'nodePositions' | 'labelOffsets' | 'edgeRoutes' | 'handleAnchors'
  >
): DiagramLayoutState {
  return {
    nodePositions: diagram.nodePositions ?? {},
    labelOffsets: diagram.labelOffsets ?? {},
    edgeRoutes: diagram.edgeRoutes ?? {},
    handleAnchors: diagram.handleAnchors ?? {},
  }
}

/** Tree-mode geometry from `treeLayout`. */
export function resolveTreeLayoutState(
  diagram: Pick<ConnectionDiagram, 'treeLayout'>
): DiagramLayoutState {
  const tree = diagram.treeLayout ?? {}
  return {
    nodePositions: tree.nodePositions ?? {},
    labelOffsets: tree.labelOffsets ?? {},
    edgeRoutes: tree.edgeRoutes ?? {},
    handleAnchors: tree.handleAnchors ?? {},
  }
}

export type { DiagramNodePosition }
