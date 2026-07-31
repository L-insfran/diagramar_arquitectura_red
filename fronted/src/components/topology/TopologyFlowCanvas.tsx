import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type Ref,
  type SetStateAction,
} from 'react'
import { Download, Maximize2, Minimize2, Printer, Save, Scaling, SquareDashedMousePointer } from 'lucide-react'
import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  ViewportPortal,
  type ColorMode,
  type Connection,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTheme } from '../../contexts/ThemeContext'
import {
  computePortPanelLayout,
  computeRackMountedPortPanelLayout,
  isCompactPortPanel,
  isInternetCloudDeviceType,
  isStructuredCablingDeviceType,
  partitionDiagramPorts,
  portSourceHandleId,
  portSourceLaneOffsetX,
  portTargetHandleId,
  portTargetLaneOffsetX,
  TOPOLOGY_HEADER_HEIGHT,
  TOPOLOGY_HEADER_HEIGHT_PATCH,
  type PortPanelLayout,
  type PortPanelSection,
} from '../../utils/topologyPortPanel'
import { DeviceFlowNode, type DeviceFlowNodeType } from './DeviceFlowNode'
import { CloudFlowNode, type CloudFlowNodeType } from './CloudFlowNode'
import { RackFlowNode } from './RackFlowNode'
import { PortLinkEdge, type PortLinkEdgeType } from './PortLinkEdge'
import { WorkAreaFlowNode, WORK_AREA_TITLE_FONT_DEFAULT, clampWorkAreaTitleFontSize } from './WorkAreaFlowNode'
import { TopologyCanvasInteractionContext, type TopologyLinkSelection } from './TopologyCanvasContext'
import type { TopologyData, TopologyRackSummary, MediumType } from '../../types'
import { formatMediumLabel, MEDIUM_EDGE_STYLES } from '../../types'
import { compareTopologyPortPair } from '../../utils/topologyPortSort'
import {
  applyRackHierarchy,
  buildDeviceFlowNodes,
  isIntraRackEdge,
} from '../../utils/topologyRackAssemble'
import { isRackFlowNodeId, normalizeRackViewFace, type RackViewFace } from '../../utils/topologyRackLayout'
import {
  computeExportCaptureRect,
  computeTileGrid,
  getA4DiagramUsableMm,
  getExportCapturePixelSize,
  getExportShellCssDimensions,
  type PrintOrientation,
} from '../../utils/printDiagramSectorGrid'
import { PrintSectorBoundsOverlay } from './PrintSectorBoundsOverlay'
import { PortNavigationBridge } from './PortNavigationBridge'
import {
  buildPortConnectLookup,
  validatePortConnection,
} from '../../utils/topologyDragConnect'
import { fitTopologyNodesToA4Page1 } from '../../utils/topologyFitToA4'
import {
  absoluteNodePosition,
  applyWorkAreaHierarchy,
  coerceWorkAreasArray,
  createWorkAreaNode,
  detachChildrenFromWorkArea,
  newWorkAreaId,
  reparentDevicesAfterDrag,
  snapshotDevicePositions,
  snapshotNodeParents,
  snapshotWorkAreas,
  type TopologyCanvasNode,
  type TopologyDeviceNode,
  type TopologyWorkAreaPersist,
} from '../../utils/topologyWorkAreas'
import {
  mergePersistedNodeScales,
  snapshotDeviceScales,
  withSyncedDeviceNodeScales,
} from '../../utils/topologyNodeScale'

const nodeTypes = { device: DeviceFlowNode, cloud: CloudFlowNode, workArea: WorkAreaFlowNode, rack: RackFlowNode }
const edgeTypes = { portLink: PortLinkEdge }

function assignPairLinkIndices(edges: PortLinkEdgeType[]): void {
  const bySource = new Map<string, { edgeIndex: number; edgeId: string }[]>()
  const byPair = new Map<string, { edgeIndex: number; edgeId: string }[]>()

  edges.forEach((edge, edgeIndex) => {
    const pairKey = `${edge.source}::${edge.target}`
    if (!byPair.has(pairKey)) byPair.set(pairKey, [])
    byPair.get(pairKey)!.push({ edgeIndex, edgeId: edge.id })
    if (!bySource.has(edge.source)) bySource.set(edge.source, [])
    bySource.get(edge.source)!.push({ edgeIndex, edgeId: edge.id })
  })

  for (const list of byPair.values()) {
    list.sort((a, b) => a.edgeId.localeCompare(b.edgeId))
    const count = list.length
    list.forEach((ref, i) => {
      const e = edges[ref.edgeIndex]
      e.data = { ...e.data!, pairLinkIndex: i, pairLinkCount: count }
    })
  }

  for (const list of bySource.values()) {
    list.sort((a, b) => {
      const ea = edges[a.edgeIndex].data!
      const eb = edges[b.edgeIndex].data!
      const byPort = compareTopologyPortPair(ea.sourcePort, ea.targetPort, eb.sourcePort, eb.targetPort)
      if (byPort !== 0) return byPort
      return a.edgeId.localeCompare(b.edgeId)
    })
    const count = list.length
    list.forEach((ref, i) => {
      const e = edges[ref.edgeIndex]
      e.data = { ...e.data!, sourceFanIndex: i, sourceFanCount: count }
    })
  }
}

/** Elige el lado del nodo que mira al peer, para que el cable salga/entre por ese borde. */
function orientPortEdgeHandles(
  nodes: TopologyCanvasNode[],
  edges: PortLinkEdgeType[],
  layoutByNodeId: Map<string, PortPanelLayout>,
  portIndexByNode: Map<string, Map<string, number>>,
  portSectionByNode: Map<string, Map<string, PortPanelSection>>,
): PortLinkEdgeType[] {
  const byId = new Map<string, Node>(nodes.map((n) => [n.id, n]))

  return edges.map((edge) => {
    const d = edge.data
    if (!d?.usePortHandles || !d.sourcePortId || !d.targetPortId) return edge

    const sourceNode = byId.get(edge.source)
    const targetNode = byId.get(edge.target)
    if (!sourceNode || !targetNode) return edge

    const sourceIsCloud = sourceNode.type === 'cloud'
    const targetIsCloud = targetNode.type === 'cloud'

    const sourceH = sourceNode.height ?? (sourceNode.style?.height as number | undefined) ?? 0
    const targetH = targetNode.height ?? (targetNode.style?.height as number | undefined) ?? 0
    const sourceAbs = absoluteNodePosition(sourceNode, byId)
    const targetAbs = absoluteNodePosition(targetNode, byId)
    const sourceCy = sourceAbs.y + sourceH / 2
    const targetCy = targetAbs.y + targetH / 2
    const targetAbove = targetCy < sourceCy - 12

    const sourceSide: 'top' | 'bottom' = targetAbove ? 'top' : 'bottom'
    const targetSide: 'top' | 'bottom' = targetAbove ? 'bottom' : 'top'

    const sourceLayout = layoutByNodeId.get(edge.source)
    const targetLayout = layoutByNodeId.get(edge.target)
    const sourceSeq = portIndexByNode.get(edge.source)?.get(d.sourcePortId)
    const targetSeq = portIndexByNode.get(edge.target)?.get(d.targetPortId)
    const sourceSection = portSectionByNode.get(edge.source)?.get(d.sourcePortId) ?? 'physical'
    const targetSection = portSectionByNode.get(edge.target)?.get(d.targetPortId) ?? 'physical'

    const sourceLaneOffsetX =
      sourceIsCloud
        ? 0
        : sourceLayout && d.sourcePortNumber != null
          ? portSourceLaneOffsetX(d.sourcePortNumber, sourceLayout, sourceSeq, sourceSide, sourceSection)
          : 0
    const targetLaneOffsetX =
      targetIsCloud
        ? 0
        : targetLayout && d.targetPortNumber != null
          ? portTargetLaneOffsetX(d.targetPortNumber, targetLayout, targetSeq, targetSide, targetSection)
          : 0

    return {
      ...edge,
      sourceHandle: portSourceHandleId(d.sourcePortId, sourceSide, d.sourceFace ?? 'front'),
      targetHandle: portTargetHandleId(d.targetPortId, targetSide, d.targetFace ?? 'front'),
      data: {
        ...d,
        sourceExitSide: sourceSide,
        targetEntrySide: targetSide,
        sourceLaneOffsetX,
        targetLaneOffsetX,
      },
    }
  })
}

function buildPortLayoutMaps(nodes: TopologyDeviceNode[]): {
  layoutByNodeId: Map<string, PortPanelLayout>
  portIndexByNode: Map<string, Map<string, number>>
  portSectionByNode: Map<string, Map<string, PortPanelSection>>
} {
  const layoutByNodeId = new Map<string, PortPanelLayout>()
  const portIndexByNode = new Map<string, Map<string, number>>()
  const portSectionByNode = new Map<string, Map<string, PortPanelSection>>()
  for (const n of nodes) {
    if (n.type === 'cloud' || isInternetCloudDeviceType(n.data.deviceType)) {
      const byId = new Map<string, number>()
      const sectionById = new Map<string, PortPanelSection>()
      ;(n.data.ports ?? []).forEach((p, i) => {
        byId.set(p.id, i)
        sectionById.set(p.id, 'physical')
      })
      portIndexByNode.set(n.id, byId)
      portSectionByNode.set(n.id, sectionById)
      continue
    }
    const { physical, wireless } = partitionDiagramPorts(n.data.ports ?? [])
    const totalPhysical =
      n.data.totalPortCount != null
        ? Math.max(0, n.data.totalPortCount - wireless.length)
        : physical.length
    const compact = isCompactPortPanel(physical.length, totalPhysical)
    const headerHeight = isStructuredCablingDeviceType(n.data.deviceType)
      ? TOPOLOGY_HEADER_HEIGHT_PATCH
      : TOPOLOGY_HEADER_HEIGHT
    layoutByNodeId.set(
      n.id,
      n.data.rackMounted
        ? computeRackMountedPortPanelLayout(
            physical.length,
            totalPhysical,
            wireless.length,
            n.width ?? n.data.nodeWidth ?? 380,
            n.height ?? n.data.nodeHeight ?? 44,
          )
        : computePortPanelLayout(physical.length, compact, totalPhysical, headerHeight, wireless.length),
    )
    const byId = new Map<string, number>()
    const sectionById = new Map<string, PortPanelSection>()
    physical.forEach((p, i) => {
      byId.set(p.id, i)
      sectionById.set(p.id, 'physical')
    })
    wireless.forEach((p, i) => {
      byId.set(p.id, i)
      sectionById.set(p.id, 'wireless')
    })
    portIndexByNode.set(n.id, byId)
    portSectionByNode.set(n.id, sectionById)
  }
  return { layoutByNodeId, portIndexByNode, portSectionByNode }
}

function withOrientedPortHandles(
  nodes: TopologyCanvasNode[],
  edges: PortLinkEdgeType[],
): PortLinkEdgeType[] {
  const devices = nodes.filter(
    (n): n is TopologyDeviceNode => n.type === 'device' || n.type === 'cloud',
  )
  const { layoutByNodeId, portIndexByNode, portSectionByNode } = buildPortLayoutMaps(devices)
  return orientPortEdgeHandles(nodes, edges, layoutByNodeId, portIndexByNode, portSectionByNode)
}

function topologyToFlowElements(data: TopologyData): {
  nodes: TopologyDeviceNode[]
  edges: PortLinkEdgeType[]
} {
  const layoutByNodeId = new Map<string, PortPanelLayout>()
  const nodes = buildDeviceFlowNodes(data)

  for (const n of nodes) {
    if (n.type === 'cloud') continue
    const allPorts = n.data.ports ?? []
    const { physical, wireless } = partitionDiagramPorts(allPorts)
    const totalPortCount = n.data.totalPortCount ?? allPorts.length
    const totalPhysicalCount = Math.max(0, totalPortCount - wireless.length)
    const compact = isCompactPortPanel(physical.length, totalPhysicalCount)
    const headerHeight = isStructuredCablingDeviceType(n.data.deviceType)
      ? TOPOLOGY_HEADER_HEIGHT_PATCH
      : TOPOLOGY_HEADER_HEIGHT
    layoutByNodeId.set(
      n.id,
      n.data.rackMounted
        ? computeRackMountedPortPanelLayout(
            physical.length,
            totalPhysicalCount,
            wireless.length,
            n.data.nodeWidth ?? 380,
            n.data.nodeHeight ?? 44,
          )
        : computePortPanelLayout(
            physical.length,
            compact,
            totalPhysicalCount,
            headerHeight,
            wireless.length,
          ),
    )
  }

  const colorById = new Map(nodes.map((n) => [n.id, n.data.accentColor]))
  const portCountById = new Map(nodes.map((n) => [n.id, n.data.totalPortCount ?? 0]))
  const cloudNodeIds = new Set(nodes.filter((n) => n.type === 'cloud').map((n) => n.id))
  const portIndexByNode = new Map<string, Map<string, number>>()
  const portSectionByNode = new Map<string, Map<string, PortPanelSection>>()
  for (const n of nodes) {
    const { physical, wireless } = partitionDiagramPorts(n.data.ports ?? [])
    const byId = new Map<string, number>()
    const sectionById = new Map<string, PortPanelSection>()
    if (n.type === 'cloud') {
      ;(n.data.ports ?? []).forEach((p, i) => {
        byId.set(p.id, i)
        sectionById.set(p.id, 'physical')
      })
    } else {
      physical.forEach((p, i) => {
        byId.set(p.id, i)
        sectionById.set(p.id, 'physical')
      })
      wireless.forEach((p, i) => {
        byId.set(p.id, i)
        sectionById.set(p.id, 'wireless')
      })
    }
    portIndexByNode.set(n.id, byId)
    portSectionByNode.set(n.id, sectionById)
  }

  const edges: PortLinkEdgeType[] = data.edges.map((e) => {
    const medium = e.medium ?? {
      mediumType: 'utp' as MediumType,
      cableCategory: null,
      fiberType: null,
      fiberConnector: null,
      wifiSsid: null,
      wifiStandard: null,
      wifiBand: null,
      wifiSecurity: null,
      cableLength: null,
    }
    const touchesCloud = cloudNodeIds.has(e.source) || cloudNodeIds.has(e.target)
    const effectiveMediumType: MediumType =
      medium.mediumType === 'utp' && touchesCloud ? 'internet' : medium.mediumType
    const edgeStyle = MEDIUM_EDGE_STYLES[effectiveMediumType] ?? MEDIUM_EDGE_STYLES.utp
    const isLogical = e.connectionType === 'logical'
    const isInternetLink = effectiveMediumType === 'internet'
    const usePortHandles = !!(e.sourcePortId && e.targetPortId)

    const sourceLayout = layoutByNodeId.get(e.source)
    const targetLayout = layoutByNodeId.get(e.target)
    const sourceSeq = e.sourcePortId ? portIndexByNode.get(e.source)?.get(e.sourcePortId) : undefined
    const targetSeq = e.targetPortId ? portIndexByNode.get(e.target)?.get(e.targetPortId) : undefined
    const sourceSection = e.sourcePortId
      ? portSectionByNode.get(e.source)?.get(e.sourcePortId) ?? 'physical'
      : 'physical'
    const targetSection = e.targetPortId
      ? portSectionByNode.get(e.target)?.get(e.targetPortId) ?? 'physical'
      : 'physical'
    const sourceIsCloud = cloudNodeIds.has(e.source)
    const targetIsCloud = cloudNodeIds.has(e.target)
    const sourceLaneOffsetX =
      usePortHandles && !sourceIsCloud && sourceLayout && e.sourcePortNumber != null
        ? portSourceLaneOffsetX(e.sourcePortNumber, sourceLayout, sourceSeq, 'bottom', sourceSection)
        : 0
    const targetLaneOffsetX =
      usePortHandles && !targetIsCloud && targetLayout && e.targetPortNumber != null
        ? portTargetLaneOffsetX(e.targetPortNumber, targetLayout, targetSeq, 'top', targetSection)
        : 0

    const mediumForLabel =
      effectiveMediumType === medium.mediumType
        ? medium
        : { ...medium, mediumType: effectiveMediumType }

    return {
      id: e.id,
      type: 'portLink' as const,
      source: e.source,
      target: e.target,
      sourceHandle: usePortHandles
        ? portSourceHandleId(e.sourcePortId, 'bottom', e.sourceFace ?? 'front')
        : undefined,
      targetHandle: usePortHandles
        ? portTargetHandleId(e.targetPortId, 'top', e.targetFace ?? 'front')
        : undefined,
      zIndex: 1000,
      animated: isLogical || isInternetLink,
      style: {
        stroke: edgeStyle.stroke,
        strokeWidth: isInternetLink ? 2.5 : 2,
        strokeDasharray: edgeStyle.strokeDasharray,
      },
      data: {
        sourcePort: e.sourcePort,
        targetPort: e.targetPort,
        sourcePortId: e.sourcePortId,
        targetPortId: e.targetPortId,
        sourceFace: e.sourceFace ?? 'front',
        targetFace: e.targetFace ?? 'front',
        sourceColor: colorById.get(e.source) ?? '#64748b',
        targetColor: colorById.get(e.target) ?? '#64748b',
        sourcePortNumber: e.sourcePortNumber,
        targetPortNumber: e.targetPortNumber,
        sourcePortCount: portCountById.get(e.source) ?? 0,
        sourceExitSide: 'bottom' as const,
        targetEntrySide: 'top' as const,
        sourceLaneOffsetX,
        targetLaneOffsetX,
        sourceFanIndex: 0,
        sourceFanCount: 1,
        targetFanIndex: 0,
        targetFanCount: 1,
        pairLinkIndex: 0,
        pairLinkCount: 1,
        mediumType: effectiveMediumType,
        mediumLabel: formatMediumLabel(mediumForLabel),
        connectionStatus: e.connectionStatus ?? 'implemented',
        networkLabel: e.networkLabel,
        vlanLabel: e.vlanLabel,
        portRole: e.portRole,
        usePortHandles,
      },
    }
  })

  assignPairLinkIndices(edges)

  // Sin dagre global: racks + sueltos se posicionan en applyRackHierarchy / posiciones guardadas.
  const oriented = orientPortEdgeHandles(
    nodes,
    edges,
    layoutByNodeId,
    portIndexByNode,
    portSectionByNode,
  )
  return { nodes, edges: oriented }
}

function withIntraRackEdgeLegibility(
  nodes: TopologyCanvasNode[],
  edges: PortLinkEdgeType[],
): PortLinkEdgeType[] {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  return edges.map((edge) => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    const hidden = !!(source?.hidden || target?.hidden)
    const intra = isIntraRackEdge(edge, nodes)
    const selected = !!edge.selected
    return {
      ...edge,
      hidden,
      zIndex: selected ? 1002 : intra ? 900 : 1000,
      style: {
        ...edge.style,
        strokeWidth: selected ? 3 : intra ? 1.5 : (edge.style?.strokeWidth as number | undefined) ?? 2,
      },
    }
  })
}

export type EdgeLayoutPersist = {
  x: number
  y: number
  bendX?: number
  bendY?: number
}

function mergePersistedEdgeLayout(
  edges: PortLinkEdgeType[],
  layouts: Readonly<Record<string, EdgeLayoutPersist>>
): PortLinkEdgeType[] {
  return edges.map((e) => {
    const o = layouts[e.id]
    if (!o) return e
    return {
      ...e,
      data: {
        ...e.data!,
        labelOffsetX: o.x,
        labelOffsetY: o.y,
        pathBendX: o.bendX ?? 0,
        pathBendY: o.bendY ?? 0,
      },
    }
  })
}

const NODE_POS_STORAGE_PREFIX = 'nm-topology-node-pos:'
const NODE_SCALE_STORAGE_PREFIX = 'nm-topology-node-scale:'
const LABEL_OFFSET_STORAGE_PREFIX = 'nm-topology-label-offset:'
const WORK_AREAS_STORAGE_PREFIX = 'nm-topology-work-areas:'
const NODE_PARENTS_STORAGE_PREFIX = 'nm-topology-node-parents:'

function loadNodePositions(key: string): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(NODE_POS_STORAGE_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, { x: number; y: number }>
  } catch { return {} }
}

function saveNodePositions(key: string, positions: Record<string, { x: number; y: number }>) {
  try { localStorage.setItem(NODE_POS_STORAGE_PREFIX + key, JSON.stringify(positions)) }
  catch { /* quota / private mode */ }
}

function clearNodePositions(key: string) {
  try { localStorage.removeItem(NODE_POS_STORAGE_PREFIX + key) }
  catch { /* ignore */ }
}

function loadNodeScales(key: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(NODE_SCALE_STORAGE_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, number> = {}
    for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[id] = value
    }
    return out
  } catch { return {} }
}

function saveNodeScales(key: string, scales: Record<string, number>) {
  try { localStorage.setItem(NODE_SCALE_STORAGE_PREFIX + key, JSON.stringify(scales)) }
  catch { /* quota / private mode */ }
}

function clearNodeScales(key: string) {
  try { localStorage.removeItem(NODE_SCALE_STORAGE_PREFIX + key) }
  catch { /* ignore */ }
}

function loadWorkAreas(key: string): TopologyWorkAreaPersist[] {
  try {
    const raw = localStorage.getItem(WORK_AREAS_STORAGE_PREFIX + key)
    if (!raw) return []
    return coerceWorkAreasArray(JSON.parse(raw) as unknown)
  } catch { return [] }
}

function resolveStoredWorkAreas(
  serverLayout: TopologyServerLayout | undefined,
  localAreas: TopologyWorkAreaPersist[],
): TopologyWorkAreaPersist[] {
  const serverAreas = coerceWorkAreasArray(serverLayout?.workAreas)
  if (serverLayout !== undefined && serverAreas.length > 0) return serverAreas
  if (localAreas.length > 0) return localAreas
  return serverAreas
}

function saveWorkAreas(key: string, areas: TopologyWorkAreaPersist[]) {
  try { localStorage.setItem(WORK_AREAS_STORAGE_PREFIX + key, JSON.stringify(areas)) }
  catch { /* quota / private mode */ }
}

function clearWorkAreas(key: string) {
  try { localStorage.removeItem(WORK_AREAS_STORAGE_PREFIX + key) }
  catch { /* ignore */ }
}

function loadNodeParents(key: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(NODE_PARENTS_STORAGE_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, string> = {}
    for (const [id, parent] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof parent === 'string' && parent.length > 0) out[id] = parent
    }
    return out
  } catch { return {} }
}

function saveNodeParents(key: string, parents: Record<string, string>) {
  try { localStorage.setItem(NODE_PARENTS_STORAGE_PREFIX + key, JSON.stringify(parents)) }
  catch { /* quota / private mode */ }
}

function clearNodeParents(key: string) {
  try { localStorage.removeItem(NODE_PARENTS_STORAGE_PREFIX + key) }
  catch { /* ignore */ }
}

function isValidLayoutEntry(v: unknown): v is EdgeLayoutPersist {
  if (v === null || typeof v !== 'object') return false
  const o = v as { x?: unknown; y?: unknown; bendX?: unknown; bendY?: unknown }
  if (typeof o.x !== 'number' || !Number.isFinite(o.x)) return false
  if (typeof o.y !== 'number' || !Number.isFinite(o.y)) return false
  if (o.bendX !== undefined && (typeof o.bendX !== 'number' || !Number.isFinite(o.bendX))) return false
  if (o.bendY !== undefined && (typeof o.bendY !== 'number' || !Number.isFinite(o.bendY))) return false
  return true
}

function loadEdgeLayouts(key: string): Record<string, EdgeLayoutPersist> {
  try {
    const raw = localStorage.getItem(LABEL_OFFSET_STORAGE_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, EdgeLayoutPersist> = {}
    for (const [id, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidLayoutEntry(val)) {
        out[id] = { x: val.x, y: val.y, bendX: val.bendX, bendY: val.bendY }
      }
    }
    return out
  } catch { return {} }
}

function saveEdgeLayouts(key: string, layouts: Record<string, EdgeLayoutPersist>) {
  try { localStorage.setItem(LABEL_OFFSET_STORAGE_PREFIX + key, JSON.stringify(layouts)) }
  catch { /* quota / private mode */ }
}

function clearEdgeLayouts(key: string) {
  try { localStorage.removeItem(LABEL_OFFSET_STORAGE_PREFIX + key) }
  catch { /* ignore */ }
}

function mergePersistedNodePositions(
  nodes: TopologyDeviceNode[],
  saved: Readonly<Record<string, { x: number; y: number }>>
): TopologyDeviceNode[] {
  return nodes.map((n) => {
    const p = saved[n.id]
    if (p == null) return n
    return { ...n, position: { x: p.x, y: p.y } }
  })
}

function persistCanvasLocal(
  key: string | undefined,
  nodes: readonly Node[],
  edgeLayouts?: Record<string, EdgeLayoutPersist>,
) {
  if (!key) return
  saveNodePositions(key, snapshotDevicePositions(nodes))
  saveNodeScales(key, snapshotDeviceScales(nodes))
  saveWorkAreas(key, snapshotWorkAreas(nodes))
  saveNodeParents(key, snapshotNodeParents(nodes))
  if (edgeLayouts) saveEdgeLayouts(key, edgeLayouts)
}

export type TopologyServerLayout = {
  nodePositions: Record<string, { x: number; y: number }>
  labelOffsets: Record<string, EdgeLayoutPersist>
  workAreas: TopologyWorkAreaPersist[]
  nodeParents: Record<string, string>
}

export type TopologyFlowCanvasHandle = {
  /**
   * Amplía temporalmente el lienzo y ajusta el zoom para que la captura PNG/PDF
   * tenga más píxeles por nodo. Devuelve una función para restaurar la vista.
   */
  prepareExportCapture: (orientation?: PrintOrientation) => Promise<() => void>
  /** Orientación actualmente seleccionada por el usuario para impresión / exportación. */
  getPrintOrientation: () => PrintOrientation
  /** Estima cuántos sectores A4 ocupará el diagrama con el layout actual. */
  estimatePrintPages: () => number
}

function DrawWorkAreaSession({
  enabled,
  draftRect,
  setDraftRect,
  onFinish,
  onCancel,
}: {
  enabled: boolean
  draftRect: { x: number; y: number; width: number; height: number } | null
  setDraftRect: Dispatch<SetStateAction<{ x: number; y: number; width: number; height: number } | null>>
  onFinish: (rect: { x: number; y: number; width: number; height: number }) => void
  onCancel: () => void
}) {
  const { screenToFlowPosition } = useReactFlow()
  const originRef = useRef<{ x: number; y: number } | null>(null)
  const draftRef = useRef(draftRect)
  draftRef.current = draftRect

  useEffect(() => {
    if (!enabled) return

    const onDown = (event: MouseEvent) => {
      if (event.button !== 0) return
      const target = event.target as HTMLElement | null
      if (!target?.closest?.('.react-flow__pane')) return
      event.preventDefault()
      event.stopPropagation()
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      originRef.current = point
      setDraftRect({ x: point.x, y: point.y, width: 0, height: 0 })
    }

    const onMove = (event: MouseEvent) => {
      if (!originRef.current) return
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      const origin = originRef.current
      setDraftRect({
        x: Math.min(origin.x, point.x),
        y: Math.min(origin.y, point.y),
        width: Math.abs(point.x - origin.x),
        height: Math.abs(point.y - origin.y),
      })
    }

    const onUp = () => {
      if (!originRef.current) return
      const rect = draftRef.current
      originRef.current = null
      setDraftRect(null)
      if (rect && rect.width >= 60 && rect.height >= 50) onFinish(rect)
      else onCancel()
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      originRef.current = null
      setDraftRect(null)
      onCancel()
    }

    window.addEventListener('mousedown', onDown, true)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  }, [enabled, onCancel, onFinish, screenToFlowPosition, setDraftRect])

  if (!draftRect || draftRect.width <= 0 || draftRect.height <= 0) return null

  return (
    <ViewportPortal>
      <div
        className="pointer-events-none border-2 border-dashed border-sky-500 bg-sky-500/10"
        style={{
          position: 'absolute',
          transform: `translate(${draftRect.x}px, ${draftRect.y}px)`,
          width: draftRect.width,
          height: draftRect.height,
        }}
      />
    </ViewportPortal>
  )
}

function SyncNodeInternalsOnGraphChange({ nodeIdsKey }: { nodeIdsKey: string }) {
  const updateNodeInternals = useUpdateNodeInternals()
  useLayoutEffect(() => {
    if (!nodeIdsKey) return
    const ids = nodeIdsKey.split(',')
    const frame = requestAnimationFrame(() => {
      for (const id of ids) updateNodeInternals(id)
    })
    return () => cancelAnimationFrame(frame)
  }, [nodeIdsKey, updateNodeInternals])
  return null
}

function GetNodesBridge({ getNodesRef }: { getNodesRef: MutableRefObject<(() => Node[]) | null> }) {
  const { getNodes } = useReactFlow()
  useLayoutEffect(() => {
    getNodesRef.current = () => getNodes()
    return () => { getNodesRef.current = null }
  }, [getNodes, getNodesRef])
  return null
}

function ExportCaptureBridge({
  exportHandleRef,
  shellElRef,
  getNodesRef,
  fullscreen,
  printOrientationRef,
}: {
  exportHandleRef?: Ref<TopologyFlowCanvasHandle | null>
  shellElRef: MutableRefObject<HTMLDivElement | null>
  getNodesRef: MutableRefObject<(() => Node[]) | null>
  fullscreen: boolean
  printOrientationRef: MutableRefObject<PrintOrientation>
}) {
  const { fitView } = useReactFlow()

  const prepareExportCapture = useCallback(async (orientation?: PrintOrientation) => {
    const shell = shellElRef.current
    if (!shell) return () => {}
    const effectiveOrientation = orientation ?? printOrientationRef.current
    const nodeCount = (getNodesRef.current?.() ?? []).length
    const { w, h } = getExportShellCssDimensions(nodeCount, effectiveOrientation)
    const prevCssText = shell.style.cssText
    const extra = `position:fixed!important;left:0!important;top:0!important;width:${w}px!important;height:${h}px!important;min-height:${h}px!important;max-height:none!important;z-index:2147483646!important;background:#f8fafc!important;`
    shell.style.cssText = prevCssText + extra

    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await fitView({ padding: 0.08, duration: 0, maxZoom: 4 })
    await new Promise<void>((r) => requestAnimationFrame(() => r()))

    return () => {
      shell.style.cssText = prevCssText
      requestAnimationFrame(() => {
        void fitView({ padding: fullscreen ? 0.12 : 0.2, duration: 0 })
      })
    }
  }, [fitView, fullscreen, getNodesRef, shellElRef, printOrientationRef])

  const getPrintOrientation = useCallback(() => printOrientationRef.current, [printOrientationRef])

  const estimatePrintPages = useCallback(() => {
    const nodes = getNodesRef.current?.() ?? []
    if (nodes.length === 0) return 1
    const orientation = printOrientationRef.current
    const { imgW, imgH } = getExportCapturePixelSize(nodes.length, orientation)
    const { usableW, usableH } = getA4DiagramUsableMm(orientation)
    const { cols, rows } = computeTileGrid(imgW, imgH, usableW, usableH)
    return Math.max(1, cols * rows)
  }, [getNodesRef, printOrientationRef])

  useImperativeHandle(
    exportHandleRef,
    () => ({ prepareExportCapture, getPrintOrientation, estimatePrintPages }),
    [prepareExportCapture, getPrintOrientation, estimatePrintPages]
  )

  return null
}

function FitViewAfterLayoutChange({ fullscreen }: { fullscreen: boolean }) {
  const { fitView } = useReactFlow()
  const prevFullscreen = useRef<boolean | null>(null)
  useEffect(() => {
    if (prevFullscreen.current === null) { prevFullscreen.current = fullscreen; return }
    if (prevFullscreen.current === fullscreen) return
    prevFullscreen.current = fullscreen
    const id = window.requestAnimationFrame(() => { fitView({ padding: fullscreen ? 0.12 : 0.2 }) })
    return () => cancelAnimationFrame(id)
  }, [fullscreen, fitView])
  return null
}

type LayoutSaveState = 'idle' | 'saving' | 'saved' | 'error'

function saveLayoutButtonLabel(state: LayoutSaveState): string {
  if (state === 'saving') return 'Guardando…'
  if (state === 'saved') return 'Guardado'
  if (state === 'error') return 'Error al guardar'
  return 'Guardar en servidor'
}

function TopologyFlowPanels({
  persistenceKey, topology, setNodes, setEdges, edgeLayoutsRef, fullscreen, onFullscreenChange, onExportPdf, exporting, readOnly,
  onPersistLayout, onClearServerLayout, layoutSaveState, onSaveLayout, showPrintBounds, onTogglePrintBounds, onShowPrintBounds,
  printOrientation, onPrintOrientationChange, drawAreaMode, onToggleDrawAreaMode, onResetGraph, persistLayoutLocalFromNodes,
}: {
  persistenceKey: string | undefined
  topology: TopologyData
  setNodes: Dispatch<SetStateAction<TopologyCanvasNode[]>>
  setEdges: Dispatch<SetStateAction<PortLinkEdgeType[]>>
  edgeLayoutsRef: MutableRefObject<Record<string, EdgeLayoutPersist>>
  fullscreen: boolean
  onFullscreenChange: (next: boolean) => void
  onExportPdf?: () => void
  exporting?: boolean
  readOnly?: boolean
  onPersistLayout?: (payload: TopologyServerLayout) => Promise<void>
  onClearServerLayout?: () => Promise<void>
  layoutSaveState: LayoutSaveState
  onSaveLayout: () => void
  showPrintBounds: boolean
  onTogglePrintBounds: () => void
  onShowPrintBounds: () => void
  printOrientation: PrintOrientation
  onPrintOrientationChange: (next: PrintOrientation) => void
  drawAreaMode: boolean
  onToggleDrawAreaMode: () => void
  onResetGraph: () => void
  persistLayoutLocalFromNodes: (nds: TopologyCanvasNode[]) => void
}) {
  const { fitView, fitBounds, getNodes } = useReactFlow()

  const handleFitToPrint = useCallback(() => {
    const rect = computeExportCaptureRect(getNodes(), printOrientation)
    if (!rect) return
    onShowPrintBounds()
    requestAnimationFrame(() => {
      void fitBounds(rect, { padding: 0, duration: 300 })
    })
  }, [fitBounds, getNodes, onShowPrintBounds, printOrientation])

  const handleFitToA4 = useCallback(() => {
    const current = getNodes() as TopologyCanvasNode[]
    const result = fitTopologyNodesToA4Page1(current, printOrientation)
    if (!result) return
    const next = result.nodes as TopologyCanvasNode[]
    setNodes(next)
    persistLayoutLocalFromNodes(next)
    setEdges((prev) => withIntraRackEdgeLegibility(next, withOrientedPortHandles(next, prev)))
    onShowPrintBounds()
    requestAnimationFrame(() => {
      const rect = computeExportCaptureRect(next, printOrientation)
      if (rect) void fitBounds(rect, { padding: 0.04, duration: 300 })
    })
  }, [
    getNodes,
    printOrientation,
    setNodes,
    setEdges,
    persistLayoutLocalFromNodes,
    onShowPrintBounds,
    fitBounds,
  ])

  const handleReset = useCallback(async () => {
    if (!persistenceKey) return
    try {
      if (onClearServerLayout) await onClearServerLayout()
    } catch { /* continuar con reset local */ }
    clearNodePositions(persistenceKey)
    clearNodeScales(persistenceKey)
    clearEdgeLayouts(persistenceKey)
    clearWorkAreas(persistenceKey)
    clearNodeParents(persistenceKey)
    edgeLayoutsRef.current = {}
    onResetGraph()
    requestAnimationFrame(() => fitView({ padding: 0.2 }))
  }, [persistenceKey, onClearServerLayout, edgeLayoutsRef, onResetGraph, fitView])

  void topology

  return (
    <Panel
      position="top-right"
      className="!m-2 !rounded-lg !border !border-gray-200 !bg-white/95 !p-1 !shadow-md dark:!border-gray-700 dark:!bg-gray-900/95"
    >
      <div className="flex flex-col gap-1 min-w-[188px]">
        {!fullscreen && (
          <button type="button" onClick={() => onFullscreenChange(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Ver diagrama en pantalla completa">
            <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Pantalla completa
          </button>
        )}
        {onExportPdf && (
          <button type="button" onClick={onExportPdf} disabled={exporting}
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
            title="Exportar diagrama a PDF">
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {exporting ? 'Exportando…' : 'Exportar PDF'}
          </button>
        )}
        <div className="flex items-stretch rounded-md border border-gray-200 overflow-hidden dark:border-gray-700">
          <button
            type="button"
            onClick={() => onPrintOrientationChange('landscape')}
            aria-pressed={printOrientation === 'landscape'}
            className={`flex-1 px-2 py-1 text-[11px] font-semibold transition ${
              printOrientation === 'landscape'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
            }`}
            title="Imprimir / exportar en horizontal (A4 apaisado)">
            Horizontal
          </button>
          <button
            type="button"
            onClick={() => onPrintOrientationChange('portrait')}
            aria-pressed={printOrientation === 'portrait'}
            className={`flex-1 px-2 py-1 text-[11px] font-semibold transition ${
              printOrientation === 'portrait'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
            }`}
            title="Imprimir / exportar en vertical (A4 retrato)">
            Vertical
          </button>
        </div>
        <button
          type="button"
          onClick={handleFitToPrint}
          className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          title="Centra la vista al tamaño real que se exportará y muestra los límites de impresión">
          <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Vista para impresión
        </button>
        <button
          type="button"
          onClick={onTogglePrintBounds}
          aria-pressed={showPrintBounds}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            showPrintBounds
              ? 'bg-orange-100 text-orange-900 ring-1 ring-orange-300 dark:bg-orange-950/60 dark:text-orange-100 dark:ring-orange-700'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
          }`}
          title="Muestra la página 1 (A4) y los sectores extra si el diagrama desborda">
          {showPrintBounds ? 'Ocultar límites' : 'Mostrar límites'}
        </button>
        {!readOnly && (
          <button
            type="button"
            onClick={handleFitToA4}
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-orange-900 transition hover:bg-orange-50 dark:text-orange-100 dark:hover:bg-orange-950/40"
            title="Mueve y escala el diagrama para que entre en la página 1 A4">
            <Scaling className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Ajustar a A4
          </button>
        )}
        {!readOnly && (
          <button
            type="button"
            onClick={onToggleDrawAreaMode}
            aria-pressed={drawAreaMode}
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              drawAreaMode
                ? 'bg-sky-100 text-sky-900 ring-1 ring-sky-300 dark:bg-sky-950/60 dark:text-sky-100 dark:ring-sky-700'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
            }`}
            title="Arrastrá en el lienzo para dibujar un área de trabajo punteada">
            <SquareDashedMousePointer className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {drawAreaMode ? 'Dibujando área…' : 'Dibujar área'}
          </button>
        )}
        {(persistenceKey && (onPersistLayout || persistenceKey)) && (
          <div className="h-px bg-gray-200/80 dark:bg-gray-700/70 mx-1 my-1" />
        )}
        {persistenceKey && onPersistLayout && (
          <button type="button" onClick={onSaveLayout} disabled={layoutSaveState === 'saving'}
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-950/50 disabled:opacity-50"
            title="Guardar posiciones en el servidor">
            <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {saveLayoutButtonLabel(layoutSaveState)}
          </button>
        )}
        {persistenceKey && (
          <button type="button" onClick={() => void handleReset()}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
            Restaurar posiciones
          </button>
        )}
        {readOnly && (
          <div className="px-2 pt-1">
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              Solo lectura
            </span>
          </div>
        )}
        {drawAreaMode && (
          <p className="px-2 pb-1 text-[10px] leading-snug text-sky-800 dark:text-sky-200">
            Arrastrá en el fondo para crear el recuadro. Esc cancela.
          </p>
        )}
        {showPrintBounds && !drawAreaMode && (
          <p className="px-2 pb-1 text-[10px] leading-snug text-orange-800 dark:text-orange-200">
            Página 1 resaltada. Arrastrá equipos para que entren, o usá «Ajustar a A4».
          </p>
        )}
        {!readOnly && !drawAreaMode && !showPrintBounds && (
          <p className="px-2 pb-1 text-[10px] leading-snug text-gray-500 dark:text-gray-400">
            Arrastrá de un puerto libre a otro para crear un enlace.
          </p>
        )}
      </div>
    </Panel>
  )
}

interface InnerProps {
  topology: TopologyData
  racks?: TopologyRackSummary[]
  persistenceKey?: string
  readOnly?: boolean
  onNavigateToDevice?: (deviceId: string) => void
  onNavigateToConnection?: (connectionId: string) => void
  onConnectPorts?: (
    sourcePortId: string,
    targetPortId: string,
    sourceFace: 'front' | 'rear',
    targetFace: 'front' | 'rear',
  ) => void | Promise<void>
  fullscreen: boolean
  onFullscreenChange: (next: boolean) => void
  canvasRef?: MutableRefObject<HTMLDivElement | null>
  onExportPdf?: () => void
  exporting?: boolean
  /** `undefined`: aún no cargó el layout del servidor */
  serverLayout?: TopologyServerLayout | undefined
  onPersistLayout?: (payload: TopologyServerLayout) => Promise<void>
  onClearServerLayout?: () => Promise<void>
  exportHandleRef?: Ref<TopologyFlowCanvasHandle | null>
}

function TopologyFlowInner({
  topology, racks = [], persistenceKey, readOnly, onNavigateToDevice, onNavigateToConnection, onConnectPorts, fullscreen, onFullscreenChange, canvasRef, onExportPdf, exporting,
  serverLayout, onPersistLayout, onClearServerLayout, exportHandleRef,
}: InnerProps) {
  const { theme } = useTheme()
  const colorMode: ColorMode = theme === 'dark' ? 'dark' : 'light'
  const edgeLayoutsRef = useRef<Record<string, EdgeLayoutPersist>>({})
  const shellElRef = useRef<HTMLDivElement | null>(null)
  const getNodesRef = useRef<(() => Node[]) | null>(null)
  const layoutSaveResetTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const [layoutSaveState, setLayoutSaveState] = useState<LayoutSaveState>('idle')
  const [showPrintBounds, setShowPrintBounds] = useState(false)
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>('landscape')
  const [selection, setSelection] = useState<TopologyLinkSelection | null>(null)
  const [drawAreaMode, setDrawAreaMode] = useState(false)
  const [draftRect, setDraftRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [rackFaces, setRackFaces] = useState<Record<string, RackViewFace>>({})
  const printOrientationRef = useRef<PrintOrientation>('landscape')
  useEffect(() => { printOrientationRef.current = printOrientation }, [printOrientation])

  const setRackFace = useCallback((rackNodeId: string, face: RackViewFace) => {
    setRackFaces((prev) => {
      if (normalizeRackViewFace(prev[rackNodeId]) === face) return prev
      return { ...prev, [rackNodeId]: face }
    })
  }, [])

  const selectPort = useCallback((portId: string | null) => {
    setSelection(portId ? { kind: 'port', portId } : null)
  }, [])

  const clearPortSelection = useCallback(() => {
    setSelection(null)
  }, [])

  const handleEdgeDoubleClick = useCallback(
    (_event: ReactMouseEvent, edge: PortLinkEdgeType) => {
      onNavigateToConnection?.(edge.id)
    },
    [onNavigateToConnection],
  )

  const handleEdgeClick = useCallback(
    (_event: ReactMouseEvent, edge: PortLinkEdgeType) => {
      setSelection((prev) =>
        prev?.kind === 'edge' && prev.edgeId === edge.id
          ? null
          : { kind: 'edge', edgeId: edge.id },
      )
    },
    [],
  )

  const portLookup = useMemo(() => buildPortConnectLookup(topology), [topology])
  const connectingRef = useRef(false)

  const isValidConnection = useCallback(
    (connection: Connection) => {
      if (readOnly || drawAreaMode) return false
      return validatePortConnection(portLookup, connection).ok
    },
    [readOnly, drawAreaMode, portLookup],
  )

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || drawAreaMode || !onConnectPorts) return
      const result = validatePortConnection(portLookup, connection)
      if (!result.ok) return
      if (connectingRef.current) return
      connectingRef.current = true
      void Promise.resolve(
        onConnectPorts(result.sourcePortId, result.targetPortId, result.sourceFace, result.targetFace),
      ).finally(() => {
        connectingRef.current = false
      })
    },
    [readOnly, drawAreaMode, onConnectPorts, portLookup],
  )

  const resolveWorkAreasAndParents = useCallback((
    liveNodes: Node[] | null,
  ): { workAreas: TopologyWorkAreaPersist[]; parents: Record<string, string> } => {
    if (liveNodes && liveNodes.some((n) => n.type === 'workArea')) {
      return {
        workAreas: snapshotWorkAreas(liveNodes),
        parents: snapshotNodeParents(liveNodes),
      }
    }
    const localAreas = persistenceKey ? loadWorkAreas(persistenceKey) : []
    const localParents = persistenceKey ? loadNodeParents(persistenceKey) : {}
    return {
      workAreas: resolveStoredWorkAreas(serverLayout, localAreas),
      parents: serverLayout !== undefined && Object.keys(serverLayout.nodeParents ?? {}).length > 0
        ? serverLayout.nodeParents
        : Object.keys(localParents).length > 0
          ? localParents
          : (serverLayout?.nodeParents ?? {}),
    }
  }, [persistenceKey, serverLayout])

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const built = topologyToFlowElements(topology)
    const localPos = persistenceKey ? loadNodePositions(persistenceKey) : {}
    const localScales = persistenceKey ? loadNodeScales(persistenceKey) : {}
    const localLayouts = persistenceKey ? loadEdgeLayouts(persistenceKey) : {}
    const localAreas = persistenceKey ? loadWorkAreas(persistenceKey) : []
    const localParents = persistenceKey ? loadNodeParents(persistenceKey) : {}
    const hasServer = serverLayout !== undefined
    const serverPos = hasServer ? serverLayout.nodePositions : null
    const serverLayouts = hasServer ? serverLayout.labelOffsets : null
    const mergedPos = { ...localPos, ...(serverPos ?? {}) }
    let devices = mergePersistedNodeScales(built.nodes, localScales)
    let edges = mergePersistedEdgeLayout(built.edges, localLayouts)
    if (serverLayouts !== null) edges = mergePersistedEdgeLayout(edges, serverLayouts)
    const racked = applyRackHierarchy(devices, racks, mergedPos, rackFaces)
    const workAreas = resolveStoredWorkAreas(serverLayout, localAreas)
    const parents = hasServer && Object.keys(serverLayout?.nodeParents ?? {}).length > 0
      ? serverLayout!.nodeParents
      : Object.keys(localParents).length > 0
        ? localParents
        : (serverLayout?.nodeParents ?? {})
    const deviceOnly = racked.filter(
      (n): n is TopologyDeviceNode => n.type === 'device' || n.type === 'cloud',
    )
    const rackOnly = racked.filter((n) => n.type === 'rack')
    const withAreas = applyWorkAreaHierarchy(deviceOnly, workAreas, parents)
    const nodes = [...rackOnly, ...withAreas]
    edges = withIntraRackEdgeLegibility(nodes, withOrientedPortHandles(nodes, edges))
    return { nodes, edges }
  }, [topology, racks, rackFaces, persistenceKey, serverLayout])

  const [nodes, setNodes, onNodesChangeBase] = useNodesState<TopologyCanvasNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<PortLinkEdgeType>(initialEdges)

  // Quitar extent:'parent' legado de work areas; conservar extent en hijos de rack.
  useEffect(() => {
    setNodes((prev) => {
      let changed = false
      const next = prev.map((n) => {
        if (n.type === 'workArea' || n.type === 'rack' || n.extent === undefined) return n
        if (n.parentId && isRackFlowNodeId(n.parentId)) return n
        changed = true
        return { ...n, extent: undefined }
      })
      return changed ? next : prev
    })
  }, [setNodes])

  const highlightedPortIds = useMemo(() => {
    const ids = new Set<string>()
    if (!selection) return ids
    if (selection.kind === 'port') {
      ids.add(selection.portId)
      for (const edge of edges) {
        if (edge.data?.sourcePortId === selection.portId && edge.data.targetPortId) {
          ids.add(edge.data.targetPortId)
        }
        if (edge.data?.targetPortId === selection.portId && edge.data.sourcePortId) {
          ids.add(edge.data.sourcePortId)
        }
      }
      return ids
    }
    const edge = edges.find((e) => e.id === selection.edgeId)
    if (edge?.data?.sourcePortId) ids.add(edge.data.sourcePortId)
    if (edge?.data?.targetPortId) ids.add(edge.data.targetPortId)
    return ids
  }, [selection, edges])

  useEffect(() => {
    setEdges((eds) =>
      withIntraRackEdgeLegibility(
        nodes,
        eds.map((e) => {
          const match =
            selection?.kind === 'edge'
              ? e.id === selection.edgeId
              : selection?.kind === 'port'
                ? e.data?.sourcePortId === selection.portId || e.data?.targetPortId === selection.portId
                : false
          return {
            ...e,
            selected: match,
            zIndex: match ? 1002 : 1000,
            style: {
              ...e.style,
              opacity: selection && !match ? 0.22 : 1,
              strokeWidth: match ? 3 : (e.style?.strokeWidth as number | undefined),
            },
          }
        }),
      ),
    )
  }, [selection, setEdges, nodes])

  useEffect(() => {
    const { nodes: nextDevices, edges: nextEdges } = topologyToFlowElements(topology)
    const live = getNodesRef.current?.() ?? null
    const currentPositions = live ? snapshotDevicePositions(live) : {}
    const currentScales = live ? snapshotDeviceScales(live) : {}
    const localPos = persistenceKey ? loadNodePositions(persistenceKey) : {}
    const localScales = persistenceKey ? loadNodeScales(persistenceKey) : {}
    const localLayouts = persistenceKey ? loadEdgeLayouts(persistenceKey) : {}
    const hasServer = serverLayout !== undefined
    const serverPos = hasServer ? serverLayout.nodePositions : null
    const serverLayouts = hasServer ? serverLayout.labelOffsets : null
    const mergedPos = { ...localPos, ...(serverPos ?? {}), ...currentPositions }
    let devices = mergePersistedNodeScales(nextDevices, localScales)
    devices = mergePersistedNodeScales(devices, currentScales)
    let e = mergePersistedEdgeLayout(nextEdges, localLayouts)
    if (serverLayouts !== null) e = mergePersistedEdgeLayout(e, serverLayouts)
    const { workAreas, parents } = resolveWorkAreasAndParents(live)
    const racked = applyRackHierarchy(devices, racks, mergedPos, rackFaces)
    const deviceOnly = racked.filter(
      (n): n is TopologyDeviceNode => n.type === 'device' || n.type === 'cloud',
    )
    const rackOnly = racked.filter((n) => n.type === 'rack')
    const withAreas = applyWorkAreaHierarchy(deviceOnly, workAreas, parents)
    const n = [...rackOnly, ...withAreas]
    e = withIntraRackEdgeLegibility(n, withOrientedPortHandles(n, e))
    edgeLayoutsRef.current = hasServer ? { ...localLayouts, ...serverLayout!.labelOffsets } : localLayouts
    setNodes(n)
    setEdges(e)
  }, [topology, racks, rackFaces, persistenceKey, serverLayout, setNodes, setEdges, resolveWorkAreasAndParents])

  const persistLayoutLocalFromNodes = useCallback((nds: TopologyCanvasNode[]) => {
    persistCanvasLocal(persistenceKey, nds, edgeLayoutsRef.current)
  }, [persistenceKey])

  const persistNodePositionsAfterDrag = useCallback((_event: ReactMouseEvent, dragged: Node) => {
    const getNodes = getNodesRef.current
    if (!getNodes) return
    let nds = getNodes() as TopologyCanvasNode[]
    if (dragged.type !== 'workArea' && dragged.type !== 'rack') {
      nds = reparentDevicesAfterDrag(nds)
      setNodes(nds)
    }
    persistLayoutLocalFromNodes(nds)
    setEdges((prev) => withIntraRackEdgeLegibility(nds, withOrientedPortHandles(nds, prev)))
  }, [persistLayoutLocalFromNodes, setEdges, setNodes])

  const onNodesChange = useCallback((changes: NodeChange<TopologyCanvasNode>[]) => {
    onNodesChangeBase(changes)
    const resizeEnded = changes.some(
      (c) => c.type === 'dimensions' && 'resizing' in c && c.resizing === false,
    )
    if (resizeEnded) {
      queueMicrotask(() => {
        const raw = (getNodesRef.current?.() ?? []) as TopologyCanvasNode[]
        const nds = withSyncedDeviceNodeScales(raw) as TopologyCanvasNode[]
        setNodes(nds)
        persistLayoutLocalFromNodes(nds)
        setEdges((prev) => withOrientedPortHandles(nds, prev))
      })
    }
  }, [onNodesChangeBase, persistLayoutLocalFromNodes, setEdges, setNodes])

  useEffect(() => () => {
    if (layoutSaveResetTimerRef.current != null) window.clearTimeout(layoutSaveResetTimerRef.current)
  }, [])

  const handleSaveLayout = useCallback(() => {
    if (!onPersistLayout) return
    const getNodes = getNodesRef.current
    if (!getNodes) return
    setLayoutSaveState('saving')
    void (async () => {
      try {
        const nds = getNodes()
        const nodePositions = snapshotDevicePositions(nds)
        const workAreas = snapshotWorkAreas(nds)
        const nodeParents = snapshotNodeParents(nds)
        const edgeLayouts: Record<string, EdgeLayoutPersist> = {}
        for (const [id, layout] of Object.entries(edgeLayoutsRef.current)) {
          if (!isValidLayoutEntry(layout)) continue
          edgeLayouts[id] = {
            x: layout.x,
            y: layout.y,
            ...(layout.bendX !== undefined ? { bendX: layout.bendX } : {}),
            ...(layout.bendY !== undefined ? { bendY: layout.bendY } : {}),
          }
        }
        await onPersistLayout({ nodePositions, labelOffsets: edgeLayouts, workAreas, nodeParents })
        persistCanvasLocal(persistenceKey, nds, edgeLayouts)
        setLayoutSaveState('saved')
        if (layoutSaveResetTimerRef.current != null) window.clearTimeout(layoutSaveResetTimerRef.current)
        layoutSaveResetTimerRef.current = window.setTimeout(() => {
          layoutSaveResetTimerRef.current = null
          setLayoutSaveState('idle')
        }, 2000)
      } catch (err) {
        console.error('[topology] Error al guardar layout', err)
        setLayoutSaveState('error')
      }
    })()
  }, [onPersistLayout, persistenceKey])

  const renameWorkArea = useCallback((areaId: string, name: string) => {
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === areaId && n.type === 'workArea'
          ? { ...n, data: { ...n.data, name } }
          : n,
      )
      persistLayoutLocalFromNodes(next)
      return next
    })
  }, [persistLayoutLocalFromNodes, setNodes])

  const setWorkAreaTitleFontSize = useCallback((areaId: string, titleFontSize: number) => {
    const size = clampWorkAreaTitleFontSize(titleFontSize)
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === areaId && n.type === 'workArea'
          ? { ...n, data: { ...n.data, titleFontSize: size } }
          : n,
      )
      persistLayoutLocalFromNodes(next)
      return next
    })
  }, [persistLayoutLocalFromNodes, setNodes])

  const removeWorkArea = useCallback((areaId: string) => {
    setNodes((prev) => {
      const next = detachChildrenFromWorkArea(prev, areaId)
      persistLayoutLocalFromNodes(next)
      setEdges((eds) => withOrientedPortHandles(next, eds))
      return next
    })
  }, [persistLayoutLocalFromNodes, setEdges, setNodes])

  const finishDrawArea = useCallback((rect: { x: number; y: number; width: number; height: number }) => {
    setDrawAreaMode(false)
    setDraftRect(null)
    if (rect.width < 60 || rect.height < 50) return
    const suggested = `ÁREA ${nodes.filter((n) => n.type === 'workArea').length + 1}`
    const name = window.prompt('Nombre del área de trabajo', suggested)?.trim() || suggested
    const area = createWorkAreaNode({
      id: newWorkAreaId(),
      name: name.toUpperCase(),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      titleFontSize: WORK_AREA_TITLE_FONT_DEFAULT,
    })
    setNodes((prev) => {
      const devices = prev.filter((n) => n.type !== 'workArea')
      const areas = prev.filter((n) => n.type === 'workArea')
      const next = [...areas, area, ...devices]
      const reparented = reparentDevicesAfterDrag(next)
      persistLayoutLocalFromNodes(reparented)
      setEdges((eds) => withOrientedPortHandles(reparented, eds))
      return reparented
    })
  }, [nodes, persistLayoutLocalFromNodes, setEdges, setNodes])

  const cancelDrawArea = useCallback(() => {
    setDrawAreaMode(false)
    setDraftRect(null)
  }, [])

  const updateEdgeLayout = useCallback((edgeId: string, patch: Partial<EdgeLayoutPersist>) => {
    const prev = edgeLayoutsRef.current[edgeId] ?? { x: 0, y: 0, bendX: 0, bendY: 0 }
    const nextEntry: EdgeLayoutPersist = {
      x: patch.x ?? prev.x,
      y: patch.y ?? prev.y,
      bendX: patch.bendX ?? prev.bendX,
      bendY: patch.bendY ?? prev.bendY,
    }
    const next = { ...edgeLayoutsRef.current, [edgeId]: nextEntry }
    if (persistenceKey) saveEdgeLayouts(persistenceKey, next)
    edgeLayoutsRef.current = next
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId
          ? {
              ...e,
              data: {
                ...e.data!,
                labelOffsetX: nextEntry.x,
                labelOffsetY: nextEntry.y,
                pathBendX: nextEntry.bendX ?? 0,
                pathBendY: nextEntry.bendY ?? 0,
              },
            }
          : e
      )
    )
  }, [persistenceKey, setEdges])

  const commitLabelOffset = useCallback((edgeId: string, x: number, y: number) => {
    updateEdgeLayout(edgeId, { x, y })
  }, [updateEdgeLayout])

  const commitPathBend = useCallback((edgeId: string, x: number, y: number) => {
    updateEdgeLayout(edgeId, { bendX: x, bendY: y })
  }, [updateEdgeLayout])

  const resetGraph = useCallback(() => {
    setRackFaces({})
    const built = topologyToFlowElements(topology)
    const racked = applyRackHierarchy(built.nodes, racks, {}, {})
    const deviceOnly = racked.filter(
      (n): n is TopologyDeviceNode => n.type === 'device' || n.type === 'cloud',
    )
    const rackOnly = racked.filter((n) => n.type === 'rack')
    const nodes = [...rackOnly, ...deviceOnly]
    const edges = withIntraRackEdgeLegibility(nodes, withOrientedPortHandles(nodes, built.edges))
    setNodes(nodes)
    setEdges(edges)
  }, [topology, racks, setNodes, setEdges])

  const interactionValue = useMemo(
    () => ({
      readOnly: readOnly ?? false,
      commitLabelOffset,
      commitPathBend,
      onNavigateToDevice,
      onNavigateToConnection,
      selection,
      selectPort,
      highlightedPortIds,
      renameWorkArea,
      removeWorkArea,
      setWorkAreaTitleFontSize,
      setRackFace,
    }),
    [readOnly, commitLabelOffset, commitPathBend, onNavigateToDevice, onNavigateToConnection, selection, selectPort, highlightedPortIds, renameWorkArea, removeWorkArea, setWorkAreaTitleFontSize, setRackFace]
  )

  const setShellRef = useCallback(
    (el: HTMLDivElement | null) => {
      shellElRef.current = el
      if (canvasRef) canvasRef.current = el
    },
    [canvasRef]
  )

  const onInit = useCallback((instance: { fitView: (opts?: { padding?: number }) => void }) => {
    requestAnimationFrame(() => instance.fitView({ padding: 0.2 }))
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !drawAreaMode) onFullscreenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen, onFullscreenChange, drawAreaMode])

  const nodeIdsKey = useMemo(() => nodes.map((n) => n.id).join(','), [nodes])

  const shellClass = fullscreen
    ? 'fixed inset-0 z-[130] flex flex-col overflow-hidden bg-slate-50 dark:bg-gray-950'
    : 'relative h-[min(calc(100dvh-14rem),88vh)] w-full min-h-[420px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950'

  return (
    <div className={shellClass} ref={setShellRef}>
      {fullscreen && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/95">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Diagrama de arquitectura de red</p>
          <div className="flex items-center gap-2">
            {persistenceKey && onPersistLayout && (
              <button type="button" onClick={handleSaveLayout} disabled={layoutSaveState === 'saving'}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                title="Guardar posiciones en el servidor">
                <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {saveLayoutButtonLabel(layoutSaveState)}
              </button>
            )}
            {onExportPdf && (
              <button type="button" onClick={onExportPdf} disabled={exporting}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50">
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {exporting ? 'Exportando…' : 'Exportar PDF'}
              </button>
            )}
            <button type="button" onClick={() => onFullscreenChange(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Vista normal
            </button>
          </div>
        </header>
      )}
      <div className={fullscreen ? 'min-h-0 flex-1' : 'h-full w-full'}>
        <TopologyCanvasInteractionContext.Provider value={interactionValue}>
          <ReactFlow
            className={`h-full w-full topology-port-edges-above ${drawAreaMode ? 'cursor-crosshair' : ''}`}
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeDragStop={persistNodePositionsAfterDrag}
            onPaneClick={clearPortSelection}
            onEdgeClick={handleEdgeClick}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            colorMode={colorMode}
            nodesDraggable={!drawAreaMode}
            nodesConnectable={!readOnly && !drawAreaMode}
            elementsSelectable={!drawAreaMode}
            panOnDrag={!drawAreaMode}
            panOnScroll zoomOnScroll
            elevateNodesOnSelect={false}
            elevateEdgesOnSelect
            connectionMode={ConnectionMode.Loose}
            isValidConnection={isValidConnection}
            onConnect={handleConnect}
            connectionLineStyle={{ stroke: '#3b82f6', strokeWidth: 2.5 }}
            minZoom={0.15} maxZoom={4}
            onInit={onInit} fitView
            defaultEdgeOptions={{ type: 'portLink', zIndex: 1000 }}
          >
            <GetNodesBridge getNodesRef={getNodesRef} />
            <SyncNodeInternalsOnGraphChange nodeIdsKey={nodeIdsKey} />
            <ExportCaptureBridge
              exportHandleRef={exportHandleRef}
              shellElRef={shellElRef}
              getNodesRef={getNodesRef}
              fullscreen={fullscreen}
              printOrientationRef={printOrientationRef}
            />
            <FitViewAfterLayoutChange fullscreen={fullscreen} />
            <PortNavigationBridge selection={selection} edges={edges} nodes={nodes} onClearSelection={clearPortSelection} />
            <TopologyFlowPanels persistenceKey={persistenceKey} topology={topology}
              setNodes={setNodes} setEdges={setEdges} edgeLayoutsRef={edgeLayoutsRef}
              fullscreen={fullscreen} onFullscreenChange={onFullscreenChange}
              onExportPdf={onExportPdf} exporting={exporting}
              readOnly={readOnly}
              onPersistLayout={onPersistLayout} onClearServerLayout={onClearServerLayout}
              layoutSaveState={layoutSaveState} onSaveLayout={handleSaveLayout}
              showPrintBounds={showPrintBounds}
              onTogglePrintBounds={() => setShowPrintBounds((v) => !v)}
              onShowPrintBounds={() => setShowPrintBounds(true)}
              printOrientation={printOrientation}
              onPrintOrientationChange={(o) => setPrintOrientation(o)}
              drawAreaMode={drawAreaMode}
              onToggleDrawAreaMode={() => setDrawAreaMode((v) => !v)}
              onResetGraph={resetGraph}
              persistLayoutLocalFromNodes={persistLayoutLocalFromNodes}
            />
            <PrintSectorBoundsOverlay enabled={showPrintBounds} orientation={printOrientation} />
            {!readOnly && (
              <DrawWorkAreaSession
                enabled={drawAreaMode}
                draftRect={draftRect}
                setDraftRect={setDraftRect}
                onFinish={finishDrawArea}
                onCancel={cancelDrawArea}
              />
            )}
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="!bg-transparent" />
            <Controls className="!shadow-md !border-gray-200 dark:!border-gray-700 !bg-white dark:!bg-gray-900" />
            <MiniMap className="!bg-white/90 dark:!bg-gray-900/90 !border-gray-200 dark:!border-gray-700" maskColor="rgba(0,0,0,0.08)" />
          </ReactFlow>
        </TopologyCanvasInteractionContext.Provider>
      </div>
    </div>
  )
}

export interface TopologyFlowCanvasProps {
  topology: TopologyData
  racks?: TopologyRackSummary[]
  persistenceKey?: string
  readOnly?: boolean
  onNavigateToDevice?: (deviceId: string) => void
  onNavigateToConnection?: (connectionId: string) => void
  onConnectPorts?: (
    sourcePortId: string,
    targetPortId: string,
    sourceFace: 'front' | 'rear',
    targetFace: 'front' | 'rear',
  ) => void | Promise<void>
  canvasRef?: MutableRefObject<HTMLDivElement | null>
  onExportPdf?: () => void
  exporting?: boolean
  serverLayout?: TopologyServerLayout | undefined
  onPersistLayout?: (payload: TopologyServerLayout) => Promise<void>
  onClearServerLayout?: () => Promise<void>
}

export const TopologyFlowCanvas = forwardRef<TopologyFlowCanvasHandle, TopologyFlowCanvasProps>(function TopologyFlowCanvas(
  {
    topology, racks, persistenceKey, readOnly, onNavigateToDevice, onNavigateToConnection, onConnectPorts, canvasRef, onExportPdf, exporting,
    serverLayout, onPersistLayout, onClearServerLayout,
  },
  ref
) {
  const [fullscreen, setFullscreen] = useState(false)
  const hasContent = topology.nodes.length > 0 || (racks?.length ?? 0) > 0

  if (!hasContent) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-center px-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aún no hay dispositivos ni racks. Creá equipos (y montalos en racks si corresponde) para documentar la topología física.
        </p>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <TopologyFlowInner
        topology={topology}
        racks={racks}
        persistenceKey={persistenceKey}
        readOnly={readOnly}
        onNavigateToDevice={onNavigateToDevice}
        onNavigateToConnection={onNavigateToConnection}
        onConnectPorts={onConnectPorts}
        fullscreen={fullscreen}
        onFullscreenChange={setFullscreen}
        canvasRef={canvasRef}
        onExportPdf={onExportPdf}
        exporting={exporting}
        serverLayout={serverLayout}
        onPersistLayout={onPersistLayout}
        onClearServerLayout={onClearServerLayout}
        exportHandleRef={ref}
      />
    </ReactFlowProvider>
  )
})
