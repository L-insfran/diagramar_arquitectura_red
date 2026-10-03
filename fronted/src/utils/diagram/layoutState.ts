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

const EMPTY_LAYOUT: DiagramLayoutState = {
  nodePositions: {},
  labelOffsets: {},
  edgeRoutes: {},
  handleAnchors: {},
}

function stableStringify(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`
}

function sameJson(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function sameScope(a?: string[] | null, b?: string[] | null): boolean {
  const left = [...(a ?? [])].sort()
  const right = [...(b ?? [])].sort()
  return sameJson(left, right)
}

function normalizeLayout(state?: DiagramLayoutState | null): DiagramLayoutState {
  return {
    nodePositions: state?.nodePositions ?? {},
    labelOffsets: state?.labelOffsets ?? {},
    edgeRoutes: state?.edgeRoutes ?? {},
    handleAnchors: state?.handleAnchors ?? {},
  }
}

/**
 * Drop top-level JSON fields that match the diagram already loaded.
 * A field that did change is still sent whole: the API replaces that column.
 */
export function omitUnchangedDiagramFields(
  payload: UpdateConnectionDiagramPayload,
  baseline: Pick<
    ConnectionDiagram,
    | 'scopeSiteIds'
    | 'scopeAreaIds'
    | 'nodePositions'
    | 'labelOffsets'
    | 'edgeRoutes'
    | 'handleAnchors'
    | 'treeLayout'
    | 'containers'
    | 'settings'
  >
): UpdateConnectionDiagramPayload {
  const next: UpdateConnectionDiagramPayload = { ...payload }

  if (next.nodePositions !== undefined && sameJson(next.nodePositions, baseline.nodePositions ?? {})) {
    delete next.nodePositions
  }
  if (next.labelOffsets !== undefined && sameJson(next.labelOffsets, baseline.labelOffsets ?? {})) {
    delete next.labelOffsets
  }
  if (next.edgeRoutes !== undefined && sameJson(next.edgeRoutes, baseline.edgeRoutes ?? {})) {
    delete next.edgeRoutes
  }
  if (next.handleAnchors !== undefined && sameJson(next.handleAnchors, baseline.handleAnchors ?? {})) {
    delete next.handleAnchors
  }
  if (next.containers !== undefined && sameJson(next.containers, baseline.containers ?? {})) {
    delete next.containers
  }
  if (next.settings !== undefined && sameJson(next.settings, baseline.settings ?? {})) {
    delete next.settings
  }
  if (
    next.treeLayout !== undefined &&
    sameJson(normalizeLayout(next.treeLayout), normalizeLayout(baseline.treeLayout ?? EMPTY_LAYOUT))
  ) {
    delete next.treeLayout
  }
  if (next.scopeSiteIds !== undefined && sameScope(next.scopeSiteIds, baseline.scopeSiteIds)) {
    delete next.scopeSiteIds
  }
  if (next.scopeAreaIds !== undefined && sameScope(next.scopeAreaIds, baseline.scopeAreaIds)) {
    delete next.scopeAreaIds
  }

  return next
}

export type { DiagramNodePosition }
