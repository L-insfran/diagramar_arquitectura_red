import dagre from 'dagre'
import type {
  ConnectionDiagram,
  DiagramLayoutMode,
  DiagramLinkEdge,
  DiagramNodePosition,
  TopologyBoardSummary,
  TopologyNode,
  TopologyRackSummary,
} from '../../types'
import { boardFlowNodeId } from '../boardPlacement'
import { rackFlowNodeId } from './rackLayout'
import { SIMPLE_DEVICE_WIDTH } from '../../components/diagram/SimpleDeviceNode'

export type TreeLayoutNodeSize = {
  id: string
  width: number
  height: number
}

export function computeTreeLayout(
  deviceIds: string[],
  edges: DiagramLinkEdge[],
  sizes: Map<string, { width: number; height: number }>,
  deviceGap: number
): Record<string, DiagramNodePosition> {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: Math.max(40, deviceGap * 2),
    ranksep: Math.max(80, deviceGap * 3),
    marginx: 40,
    marginy: 40,
  })

  const idSet = new Set(deviceIds)
  for (const id of deviceIds) {
    const size = sizes.get(id)
    g.setNode(id, {
      width: size?.width ?? SIMPLE_DEVICE_WIDTH,
      height: size?.height ?? 120,
    })
  }

  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue
    if (e.source === e.target) continue
    g.setEdge(e.source, e.target)
  }

  dagre.layout(g)

  const positions: Record<string, DiagramNodePosition> = {}
  for (const id of deviceIds) {
    const node = g.node(id)
    if (!node) {
      positions[id] = { x: 40, y: 40 }
      continue
    }
    positions[id] = {
      x: node.x - node.width / 2,
      y: node.y - node.height / 2,
    }
  }
  return positions
}

export function isTreeLayoutMode(mode: DiagramLayoutMode | undefined): boolean {
  return mode === 'tree'
}

/** Device ids assigned to visible containers on the diagram. */
export function collectVisibleDeviceIds(params: {
  diagram: ConnectionDiagram
  inventory: TopologyNode[]
  racks: TopologyRackSummary[]
  boards: TopologyBoardSummary[]
  visibleContainerIds: string[]
}): string[] {
  const { diagram, inventory, racks, boards, visibleContainerIds } = params
  const containers = diagram.containers ?? {}
  const visibleSet = new Set(visibleContainerIds)
  const deviceById = new Set(inventory.map((d) => d.id))
  const used = new Set<string>()

  const onlyExisting = (ids: string[]) => ids.filter((id) => deviceById.has(id))

  const resolveRackDevices = (rackId: string, key: string) => {
    const saved = containers[key]
    const raw =
      saved?.deviceIds != null
        ? [...saved.deviceIds]
        : inventory.filter((d) => d.data.containerId === rackId).map((d) => d.id)
    return onlyExisting(raw)
  }

  const resolveBoardDevices = (boardId: string, key: string) => {
    const saved = containers[key]
    const raw =
      saved?.deviceIds != null
        ? [...saved.deviceIds]
        : inventory.filter((d) => d.data.containerId === boardId).map((d) => d.id)
    return onlyExisting(raw)
  }

  const resolveLooseAreaDevices = (areaId: string, key: string) => {
    const saved = containers[key]
    const raw =
      saved?.deviceIds != null
        ? [...saved.deviceIds]
        : inventory
            .filter(
              (d) =>
                d.data.areaId === areaId &&
                (!d.data.containerId ||
                  (!racks.some((r) => r.id === d.data.containerId) &&
                    !boards.some((b) => b.id === d.data.containerId)))
            )
            .map((d) => d.id)
    return onlyExisting(raw)
  }

  for (const rack of racks) {
    const key = rackFlowNodeId(rack.id)
    if (!visibleSet.has(key)) continue
    for (const id of resolveRackDevices(rack.id, key)) used.add(id)
  }
  for (const board of boards) {
    const key = boardFlowNodeId(board.id)
    if (!visibleSet.has(key)) continue
    for (const id of resolveBoardDevices(board.id, key)) used.add(id)
  }
  for (const key of visibleContainerIds) {
    if (!key.startsWith('area:')) continue
    const areaId = key.slice(5)
    for (const id of resolveLooseAreaDevices(areaId, key)) used.add(id)
  }

  return [...used]
}
