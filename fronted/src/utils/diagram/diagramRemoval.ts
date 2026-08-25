import type {
  DiagramContainerState,
  DiagramNodePosition,
  DiagramEdgeRoute,
  DiagramPoint,
  DiagramHandleAnchor,
} from '../../types'

/**
 * Collect the full subtree rooted at `rootId`: the root itself plus all
 * containers whose `parentId` chain leads back to it (recursive).
 */
export function collectContainerSubtree(
  containers: Record<string, DiagramContainerState>,
  rootId: string,
): Set<string> {
  const subtree = new Set<string>()
  subtree.add(rootId)
  let added = true
  while (added) {
    added = false
    for (const [key, state] of Object.entries(containers)) {
      if (!subtree.has(key) && state.parentId && subtree.has(state.parentId)) {
        subtree.add(key)
        added = true
      }
    }
  }
  return subtree
}

/**
 * Collect every device id that lives inside any of the given container keys.
 */
export function collectRemovedDeviceIds(
  containers: Record<string, DiagramContainerState>,
  subtreeIds: Set<string>,
  resolveDeviceIds: (containerId: string) => string[],
): Set<string> {
  const deviceIds = new Set<string>()
  for (const key of subtreeIds) {
    for (const did of resolveDeviceIds(key)) {
      deviceIds.add(did)
    }
    const saved = containers[key]
    if (saved?.deviceIds) {
      for (const did of saved.deviceIds) deviceIds.add(did)
    }
  }
  return deviceIds
}

type DiagramState = {
  containers: Record<string, DiagramContainerState>
  nodePositions: Record<string, DiagramNodePosition>
  edgeRoutes: Record<string, DiagramEdgeRoute>
  labelOffsets: Record<string, DiagramPoint>
  handleAnchors: Record<string, DiagramHandleAnchor>
}

/**
 * Return a pruned copy of the diagram state with all references to the
 * removed containers, devices, and links stripped out.
 */
export function pruneDiagramState(
  state: DiagramState,
  removedContainerIds: Set<string>,
  removedDeviceIds: Set<string>,
  removedLinkIds: Set<string>,
): DiagramState {
  const containers: Record<string, DiagramContainerState> = {}
  for (const [key, val] of Object.entries(state.containers)) {
    if (removedContainerIds.has(key)) continue
    containers[key] = val
  }

  const nodePositions: Record<string, DiagramNodePosition> = {}
  for (const [key, val] of Object.entries(state.nodePositions)) {
    if (removedDeviceIds.has(key)) continue
    nodePositions[key] = val
  }

  const edgeRoutes: Record<string, DiagramEdgeRoute> = {}
  for (const [key, val] of Object.entries(state.edgeRoutes)) {
    if (removedLinkIds.has(key)) continue
    edgeRoutes[key] = val
  }

  const labelOffsets: Record<string, DiagramPoint> = {}
  for (const [key, val] of Object.entries(state.labelOffsets)) {
    if (removedLinkIds.has(key)) continue
    labelOffsets[key] = val
  }

  const handleAnchors: Record<string, DiagramHandleAnchor> = {}
  for (const [key, val] of Object.entries(state.handleAnchors)) {
    const deviceId = key.split('::')[0]
    if (removedDeviceIds.has(deviceId)) continue
    handleAnchors[key] = val
  }

  return { containers, nodePositions, edgeRoutes, labelOffsets, handleAnchors }
}
