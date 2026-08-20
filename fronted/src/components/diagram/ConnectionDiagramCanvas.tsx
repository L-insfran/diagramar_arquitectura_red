import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  getNodesBounds,
  useEdgesState,
  useNodesState,
  type ColorMode,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import { useTheme } from '../../contexts/ThemeContext'
import {
  AreaContainerNode,
  AREA_BODY_PAD,
  applySavedAreaExtent,
  areaContentTop,
  layoutAreaChildren,
  stackLooseDevicePositions,
} from './AreaContainerNode'
import { BoardContainerNode } from './BoardContainerNode'
import { RackContainerNode, stackDevicePositions } from './RackContainerNode'
import {
  areaLooseOrigin,
  clampDeviceInContainer,
  clampDeviceMinInContainer,
  contentMinFromDeviceRects,
  emptyRackBoardFloorSize,
  rackBoardContentTop,
  resolveContainerDevicePositions,
} from '../../utils/diagram/containerLayout'
import { RoutedLinkEdge, type RoutedLinkEdgeData } from './RoutedLinkEdge'
import {
  SimpleDeviceNode,
  simpleDeviceHeight,
  SIMPLE_DEVICE_MIN_WIDTH,
  SIMPLE_DEVICE_WIDTH,
  devicePortAreaTop,
  CONTAINER_PAD,
  CONTAINER_HEADER_H,
  CONTAINER_SELECTOR_H,
  resolveDeviceGap,
  resolveDeviceNodeSize,
} from './SimpleDeviceNode'
import { accentColorForNodeId } from '../../utils/diagram/diagramAccent'
import { areaFlowNodeId } from '../../utils/areaPlacement'
import { boardFlowNodeId } from '../../utils/boardPlacement'
import { rackFlowNodeId } from '../../utils/diagram/rackLayout'
import { buildDevicePickerOption } from '../../utils/diagram/diagramContainerAssignment'
import {
  routeOrthogonalEdges,
  type DiagramRect,
  type DiagramRouteRequest,
} from '../../utils/diagram/orthogonalRouter'
import { isRouteStale, repairManualRoute } from '../../utils/diagram/routeTransform'
import { computeClearLabelOffsets } from '../../utils/diagram/edgeLabelPlacement'
import { formatEndpointLabel } from '../../utils/diagram/linkLabel'
import {
  DIAGRAM_CONNECT_SOURCE_HANDLE,
  DIAGRAM_CONNECT_TARGET_HANDLE,
} from '../../utils/diagram/diagramPortHandles'
import {
  edgeHandleId,
  edgeTargetHandleId,
  legacyToNeutralHandleId,
  normalizeHandleAnchorKeys,
  portSlotsVerticalRows,
  resolveDevicePortSlots,
  type DiagramPortSlot,
} from '../../utils/diagram/devicePortSlots'
import {
  anchorToEndpoint,
  defaultHandleAnchor,
  handleAnchorKey,
  type DiagramHandleAnchor,
} from '../../utils/diagram/handleAnchor'
import { isTreeLayoutMode } from '../../utils/diagram/treeLayout'
import {
  captureReactFlowViewport,
  type CapturedDiagram,
} from '../../utils/pdf/diagramCapturePdf'
import {
  getCaptureViewport,
  getTopLevelVisibleNodes,
  planFromNodes,
} from '../../utils/printDiagramSectorGrid'
import type { PaperFormat, PrintOrientation } from '../../utils/pdf/a4Geometry'
import { planFromFrame } from '../../utils/pdf/printFrame'
import { PrintFrameOverlay } from './PrintFrameOverlay'
import type {
  ConnectionDiagram,
  DiagramLinkEdge,
  DiagramNodePosition,
  DiagramPrintFrame,
  DiagramSettings,
  TopologyAreaSummary,
  TopologyBoardSummary,
  TopologyNode,
  TopologyRackSummary,
} from '../../types'

const nodeTypes = {
  areaContainer: AreaContainerNode,
  rackContainer: RackContainerNode,
  boardContainer: BoardContainerNode,
  simpleDevice: SimpleDeviceNode,
}

const edgeTypes = {
  routedLink: RoutedLinkEdge,
}

export type ConnectionDiagramCanvasHandle = {
  rerouteCables: () => void
  /** Resalta un enlace en el canvas y centra la vista sobre su ruta. */
  selectLink: (edgeId: string) => void
  /** Captura PNG del diagrama para export PDF (respeta el layout actual, sin reempaquetar). */
  captureDiagramPng: (
    format: PaperFormat,
    orientation: PrintOrientation,
    invertColors?: boolean,
  ) => Promise<CapturedDiagram | null>
  getContentBounds: () => { x: number; y: number; width: number; height: number } | null
  getStaleLinkIds: () => string[]
  autorouteLinks: (edgeIds: string[]) => void
  getPersistPayload: (
    printSettings?: Pick<
      DiagramSettings,
      | 'paperSize'
      | 'printOrientation'
      | 'printFrame'
      | 'printIncludeLegend'
      | 'printIncludeLinkTable'
      | 'printInvertColors'
    >,
  ) => {
    nodePositions: Record<string, DiagramNodePosition>
    labelOffsets: Record<string, { y: number; x: number; t?: number }>
    edgeRoutes: Record<string, { points: { x: number; y: number }[]; manual?: boolean }>
    containers: Record<
      string,
      {
        x: number
        y: number
        view?: 'front' | 'rear' | 'both'
        collapsed?: boolean
        deviceIds?: string[]
        parentId?: string | null
        width?: number
        height?: number
        contentMinWidth?: number
        contentMinHeight?: number
      }
    >
    settings: DiagramSettings
    handleAnchors: Record<string, DiagramHandleAnchor>
    layoutMode?: ConnectionDiagram['layoutMode']
  }
}

type Props = {
  inventory: TopologyNode[]
  edges: DiagramLinkEdge[]
  racks: TopologyRackSummary[]
  boards: TopologyBoardSummary[]
  areas: TopologyAreaSummary[]
  /** Only these container keys are drawn (e.g. area:uuid / rack:uuid). Empty = none. */
  visibleContainerIds: string[]
  diagram: ConnectionDiagram
  readOnly?: boolean
  /** Formato/orientación para overlay de márgenes de impresión. */
  paperSize?: PaperFormat
  printOrientation?: PrintOrientation
  showPrintMargins?: boolean
  /** Vista previa de inversión de colores para impresión B/N. */
  printInvertColors?: boolean
  printFrame?: DiagramPrintFrame | null
  printFrameLocked?: boolean
  onPrintFrameChange?: (frame: DiagramPrintFrame) => void
  onPrintFrameChangeEnd?: (frame: DiagramPrintFrame) => void
  onPrintDiagnostics?: (info: { outsideCount: number; cutCount: number }) => void
  onStaleLinkIdsChange?: (ids: string[]) => void
  onConnectDevices?: (params: {
    sourceDeviceId: string
    targetDeviceId: string
    sourceHandle?: string | null
    targetHandle?: string | null
  }) => void
  /** Click en etiqueta de puerto conectado → abrir modal con ese origen. */
  onPortClick?: (params: {
    deviceId: string
    handleId: string
    label: string
    side: 'source' | 'target'
  }) => void
  /** Doble clic en equipo → abrir modal de nuevo enlace. */
  onDeviceDoubleClick?: (deviceId: string) => void
  onNavigateToLink?: (linkId: string) => void
  /** Enlace resaltado desde la lista de referencia (o clic en edge). */
  focusedLinkId?: string | null
  onFocusedLinkChange?: (linkId: string | null) => void
  onAddDeviceToContainer?: (containerId: string, deviceId: string) => void
  onRemoveDeviceFromContainer?: (containerId: string, deviceId: string) => void
  onReorderDevicesInContainer?: (containerId: string, deviceIds: string[]) => void
}

function absolutePos(nodes: Node[], id: string): { x: number; y: number } | null {
  const node = nodes.find((n) => n.id === id)
  if (!node) return null
  if (!node.parentId) return { x: node.position.x, y: node.position.y }
  const parent = absolutePos(nodes, node.parentId)
  if (!parent) return node.position
  return { x: parent.x + node.position.x, y: parent.y + node.position.y }
}

function cloneFlowNodes(nodes: Node[]): Node[] {
  return nodes.map((n) => ({
    ...n,
    position: { ...n.position },
    style: n.style ? { ...n.style } : n.style,
    data: { ...(n.data as object) },
  }))
}

function cloneFlowEdges(edges: Edge<RoutedLinkEdgeData>[]): Edge<RoutedLinkEdgeData>[] {
  return edges.map((e) => ({
    ...e,
    data: {
      ...e.data,
      routePoints: e.data?.routePoints?.map((p) => ({ ...p })),
      routeManual: e.data?.routeManual,
      routeStale: e.data?.routeStale,
    },
  }))
}

function containerChromeHeight(node: Node): number {
  const hidePicker = Boolean((node.data as { hidePicker?: boolean })?.hidePicker)
  return CONTAINER_HEADER_H + (hidePicker ? 0 : CONTAINER_SELECTOR_H)
}

/**
 * Rack/board/área son huecos: los cables pueden pasar entre equipos apilados.
 * Solo bloquean el chrome (título + buscador) y los equipos individuales.
 */
function collectRouteObstacles(nodes: Node[]): DiagramRect[] {
  const obstacles: DiagramRect[] = []
  for (const n of nodes) {
    const abs = absolutePos(nodes, n.id)
    if (!abs) continue
    const w = Number(n.style?.width ?? n.width ?? 200)
    const h = Number(n.style?.height ?? n.height ?? 80)
    if (n.type === 'areaContainer') continue
    if (n.type === 'rackContainer' || n.type === 'boardContainer') {
      obstacles.push({
        id: `${n.id}:chrome`,
        x: abs.x,
        y: abs.y,
        width: w,
        height: containerChromeHeight(n),
      })
      continue
    }
    obstacles.push({ id: n.id, x: abs.x, y: abs.y, width: w, height: h })
  }
  return obstacles
}

function collectLabelObstacles(nodes: Node[]) {
  return collectRouteObstacles(nodes).map(({ x, y, width, height }) => ({
    x,
    y,
    width,
    height,
  }))
}

/** Mid-Y of the air gap between stacked sibling devices — passable Hanan rows. */
function collectStackCorridorYs(nodes: Node[]): number[] {
  const byParent = new Map<string, Node[]>()
  for (const n of nodes) {
    if (n.type !== 'simpleDevice' || !n.parentId) continue
    const list = byParent.get(n.parentId) ?? []
    list.push(n)
    byParent.set(n.parentId, list)
  }
  const ys: number[] = []
  for (const siblings of byParent.values()) {
    const sorted = [...siblings].sort((a, b) => {
      const ay = absolutePos(nodes, a.id)?.y ?? 0
      const by = absolutePos(nodes, b.id)?.y ?? 0
      return ay - by
    })
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]
      const b = sorted[i + 1]
      const aAbs = absolutePos(nodes, a.id)
      const bAbs = absolutePos(nodes, b.id)
      if (!aAbs || !bAbs) continue
      const aH = Number(a.style?.height ?? a.height ?? 36)
      const gapTop = aAbs.y + aH
      const gapBot = bAbs.y
      if (gapBot - gapTop >= 10) ys.push((gapTop + gapBot) / 2)
    }
  }
  return ys
}

function flowNodeSize(n: Node): { width: number; height: number } {
  const measured = n.measured as { width?: number; height?: number } | undefined
  const width = Number(measured?.width ?? n.width ?? n.style?.width ?? 0)
  const height = Number(measured?.height ?? n.height ?? n.style?.height ?? 0)
  return {
    width: Number.isFinite(width) && width > 0 ? width : 0,
    height: Number.isFinite(height) && height > 0 ? height : 0,
  }
}

function deviceParentChrome(
  parent: Node,
  hidePicker: boolean,
): { contentTop: number; bodyPad: number } {
  const opts = { hidePicker }
  if (parent.type === 'areaContainer') {
    const hasSub = Boolean(
      (parent.data as { hasSubContainers?: boolean })?.hasSubContainers
    )
    return {
      contentTop: areaLooseOrigin(hasSub, opts).y,
      bodyPad: AREA_BODY_PAD,
    }
  }
  return {
    contentTop: rackBoardContentTop(opts),
    bodyPad: CONTAINER_PAD,
  }
}

/** Min-only clamp so expandParent can grow the parent toward +X/+Y. */
function clampDeviceNodeMinInParent(
  node: Node,
  allNodes: Node[],
  hidePicker: boolean,
): Node {
  if (!node.parentId || node.type !== 'simpleDevice') return node
  const parent = allNodes.find((n) => n.id === node.parentId)
  if (!parent) return node
  const { contentTop, bodyPad } = deviceParentChrome(parent, hidePicker)
  return {
    ...node,
    position: clampDeviceMinInContainer(node.position, contentTop, bodyPad),
  }
}

function clampDeviceNodeInParent(
  node: Node,
  allNodes: Node[],
  hidePicker: boolean,
): Node {
  if (!node.parentId || node.type !== 'simpleDevice') return node
  const parent = allNodes.find((n) => n.id === node.parentId)
  if (!parent) return node
  const parentSize = flowNodeSize(parent)
  const deviceSize = flowNodeSize(node)
  const deviceW = deviceSize.width || SIMPLE_DEVICE_WIDTH
  const deviceH = deviceSize.height || simpleDeviceHeight(0)
  const parentW = parentSize.width
  const parentH = parentSize.height
  const { contentTop, bodyPad } = deviceParentChrome(parent, hidePicker)
  return {
    ...node,
    position: clampDeviceInContainer(
      node.position,
      deviceW,
      deviceH,
      parentW,
      parentH,
      contentTop,
      bodyPad,
    ),
  }
}

/**
 * After a nested child grows its parent (expandParent), also grow ancestors
 * so overflow-hidden areas do not clip the enlarged container.
 */
function expandAncestorsToFit(
  child: Node,
  allNodes: Node[],
  hidePicker: boolean,
): Node[] {
  let next = allNodes
  let current: Node | undefined = child
  while (current?.parentId) {
    const parentId = current.parentId
    const parent = next.find((n) => n.id === parentId)
    if (!parent) break

    const childSize = flowNodeSize(current)
    const childW =
      childSize.width ||
      (current.type === 'simpleDevice' ? SIMPLE_DEVICE_WIDTH : 0)
    const childH =
      childSize.height ||
      (current.type === 'simpleDevice' ? simpleDeviceHeight(0) : 0)
    if (childW <= 0 || childH <= 0) break

    const { bodyPad } = deviceParentChrome(parent, hidePicker)
    const needW = current.position.x + childW + bodyPad
    const needH = current.position.y + childH + bodyPad
    const parentSize = flowNodeSize(parent)
    const prevW = parentSize.width || 0
    const prevH = parentSize.height || 0
    const nextW = Math.max(prevW, needW)
    const nextH = Math.max(prevH, needH)

    if (nextW > prevW + 0.5 || nextH > prevH + 0.5) {
      const prevMinW = Number(
        (parent.data as { contentMinWidth?: number })?.contentMinWidth ?? 0
      )
      const prevMinH = Number(
        (parent.data as { contentMinHeight?: number })?.contentMinHeight ?? 0
      )
      next = next.map((n) =>
        n.id === parentId
          ? {
              ...n,
              width: nextW,
              height: nextH,
              style: { ...n.style, width: nextW, height: nextH },
              data: {
                ...n.data,
                contentMinWidth: Math.max(prevMinW, needW),
                contentMinHeight: Math.max(prevMinH, needH),
              },
            }
          : n
      )
    }

    // Nested rack/board inside area: keep chrome mins on the container itself.
    if (
      (current.type === 'rackContainer' || current.type === 'boardContainer') &&
      parent.type === 'areaContainer'
    ) {
      const minY = areaContentTop({ hidePicker })
      const clampedPos = {
        x: Math.max(AREA_BODY_PAD, current.position.x),
        y: Math.max(minY, current.position.y),
      }
      if (
        clampedPos.x !== current.position.x ||
        clampedPos.y !== current.position.y
      ) {
        next = next.map((n) =>
          n.id === current!.id ? { ...n, position: clampedPos } : n
        )
        current = { ...current, position: clampedPos }
      }
    }

    current = next.find((n) => n.id === parentId)
  }
  return next
}

function clampDeviceSizeInParent(
  node: Node,
  allNodes: Node[],
  hidePicker: boolean,
): Node {
  if (!node.parentId || node.type !== 'simpleDevice') return node
  const parent = allNodes.find((n) => n.id === node.parentId)
  if (!parent) return node
  const parentSize = flowNodeSize(parent)
  const deviceSize = flowNodeSize(node)
  const label = (node.data?.label as string) ?? ''
  const sourcePorts = (node.data?.sourcePorts as { id: string }[] | undefined) ?? []
  const targetPorts = (node.data?.targetPorts as { id: string }[] | undefined) ?? []
  const rawW = deviceSize.width || SIMPLE_DEVICE_WIDTH
  const minH = simpleDeviceHeight(
    Math.max(sourcePorts.length, targetPorts.length),
    label,
    rawW,
  )
  const edgePad = 4
  const maxW = Math.max(
    SIMPLE_DEVICE_MIN_WIDTH,
    parentSize.width - node.position.x - edgePad,
  )
  const maxH = Math.max(minH, parentSize.height - node.position.y - edgePad)
  const width = Math.min(Math.max(rawW, SIMPLE_DEVICE_MIN_WIDTH), maxW)
  const height = Math.min(Math.max(deviceSize.height || minH, minH), maxH)
  return clampDeviceNodeInParent(
    {
      ...node,
      width,
      height,
      style: { ...node.style, width, height },
    },
    allNodes,
    hidePicker,
  )
}

function clampChildrenInParent(
  allNodes: Node[],
  parentId: string,
  hidePicker: boolean,
): Node[] {
  return allNodes.map((n) => {
    if (n.parentId !== parentId || n.type !== 'simpleDevice') return n
    return clampDeviceNodeInParent(n, allNodes, hidePicker)
  })
}

function preserveContainerExtent(
  built: Node,
  existing: Node,
): { width: number; height: number } {
  const builtW = Number(built.style?.width ?? built.width ?? 0)
  const builtH = Number(built.style?.height ?? built.height ?? 0)
  const prevW = Number(existing.width ?? existing.style?.width ?? 0)
  const prevH = Number(existing.height ?? existing.style?.height ?? 0)
  if (prevW <= 0 || prevH <= 0) {
    return { width: builtW, height: builtH }
  }
  const builtMinW = Number(
    (built.data as { contentMinWidth?: number }).contentMinWidth ?? 0
  )
  const prevMinW = Number(
    (existing.data as { contentMinWidth?: number }).contentMinWidth ?? 0
  )
  const builtMinH = Number(
    (built.data as { contentMinHeight?: number }).contentMinHeight ?? 0
  )
  const prevMinH = Number(
    (existing.data as { contentMinHeight?: number }).contentMinHeight ?? 0
  )
  const contentGrew =
    (builtMinW > 0 && builtMinW > prevMinW + 0.5) ||
    (builtMinH > 0 && builtMinH > prevMinH + 0.5)
  if (contentGrew) {
    return {
      width: Math.max(prevW, builtMinW, builtW),
      height: Math.max(prevH, builtMinH, builtH),
    }
  }
  // Keep the live size so a manual shrink is not undone by auto-layout.
  return { width: prevW, height: prevH }
}

function preserveDeviceExtent(
  built: Node,
  existing: Node,
): { width: number; height: number } {
  const builtW = Number(built.style?.width ?? built.width ?? SIMPLE_DEVICE_WIDTH)
  const builtH = Number(built.style?.height ?? built.height ?? 0)
  const prevW = Number(existing.style?.width ?? existing.width ?? 0)
  const prevH = Number(existing.style?.height ?? existing.height ?? 0)
  const label = (built.data?.label as string) ?? ''
  const slots = (built.data?.slots as DiagramPortSlot[] | undefined) ?? []
  const liveW = prevW > 0 ? prevW : builtW
  const portRows =
    slots.length > 0
      ? Math.max(
          ...(['left', 'right', 'top', 'bottom'] as const).map(
            (side) => slots.filter((s) => s.anchor.side === side).length
          ),
          1
        )
      : 0
  const contentMinH = simpleDeviceHeight(
    portRows,
    label,
    liveW,
    slots.length > 0 && slots.every((s) => !s.connected)
  )
  return {
    width: liveW,
    height: Math.max(contentMinH, prevH > 0 ? prevH : builtH, builtH),
  }
}

function buildGraph(params: {
  inventory: TopologyNode[]
  edges: DiagramLinkEdge[]
  racks: TopologyRackSummary[]
  boards: TopologyBoardSummary[]
  areas: TopologyAreaSummary[]
  visibleContainerIds: string[]
  diagram: ConnectionDiagram
  readOnly: boolean
  /** Oculta buscadores y compacta altura (export PDF). */
  hidePicker?: boolean
  onAddDeviceToContainer?: (containerId: string, deviceId: string) => void
  onRemoveDeviceFromContainer?: (containerId: string, deviceId: string) => void
  onPickerOpenChange?: (containerId: string, open: boolean) => void
  onPortClick?: (params: {
    deviceId: string
    handleId: string
    label: string
    side: 'source' | 'target'
  }) => void
  onDeviceDoubleClick?: (deviceId: string) => void
  handleAnchors?: Record<string, DiagramHandleAnchor>
  onHandleAnchorChange?: (
    deviceId: string,
    handleId: string,
    anchor: DiagramHandleAnchor
  ) => void
  onHandleAnchorChangeEnd?: (
    deviceId: string,
    handleId: string,
    anchor: DiagramHandleAnchor
  ) => void
  onSlotsReorder?: (deviceId: string, slots: DiagramPortSlot[]) => void
  onRedistributePorts?: (deviceId: string) => void
}): { nodes: Node[]; edges: Edge<RoutedLinkEdgeData>[] } {
  const {
    inventory,
    edges,
    racks,
    boards,
    areas,
    visibleContainerIds,
    diagram,
    readOnly,
    hidePicker = false,
    onAddDeviceToContainer,
    onRemoveDeviceFromContainer,
    onPickerOpenChange,
    onPortClick,
    onDeviceDoubleClick,
    handleAnchors = {},
    onHandleAnchorChange,
    onHandleAnchorChangeEnd,
    onSlotsReorder,
    onRedistributePorts,
  } = params
  const deviceDraggable = !readOnly && !hidePicker
  const nodes: Node[] = []
  const containers = diagram.containers ?? {}
  const visibleSet = new Set(visibleContainerIds)
  const deviceGap = resolveDeviceGap({ deviceGap: diagram.settings?.deviceGap })
  const sizeOpts = { hidePicker, deviceGap }

  const deviceById = new Map(inventory.map((d) => [d.id, d]))
  const rackContainerIds = new Set(racks.map((r) => r.id))
  const boardContainerIds = new Set(boards.map((b) => b.id))
  const shownDeviceIds = new Set<string>()
  const shownContainerByDeviceId = new Map<string, string>()
  const nestedChildIds = new Set<string>()

  const layoutMode = diagram.layoutMode ?? 'free'
  const portDisplay = diagram.settings?.portDisplay ?? 'all'
  const portFlowInverted = diagram.settings?.portFlowInverted ?? false
  const treeMode = isTreeLayoutMode(layoutMode)
  const normalizedAnchors = normalizeHandleAnchorKeys(handleAnchors)

  /** Puertos únicos usados por diagram_links (por equipo). */
  const usedPortsByDevice = new Map<string, Set<string>>()

  const markPortUsed = (
    deviceId: string,
    portId: string | null | undefined,
    portLabel: string
  ) => {
    let set = usedPortsByDevice.get(deviceId)
    if (!set) {
      set = new Set()
      usedPortsByDevice.set(deviceId, set)
    }
    const key = portId
      ? `id:${portId}`
      : `label:${portLabel.trim().toLowerCase() || 'port'}`
    set.add(key)
  }

  for (const e of edges) {
    markPortUsed(e.source, e.sourcePortId, e.sourcePort)
    markPortUsed(e.target, e.targetPortId, e.targetPort)
  }

  const deviceAnchorsFor = (deviceId: string): Record<string, DiagramHandleAnchor> => {
    const out: Record<string, DiagramHandleAnchor> = {}
    for (const [key, val] of Object.entries(normalizedAnchors)) {
      if (!key.startsWith(`${deviceId}::`)) continue
      const handleId = legacyToNeutralHandleId(key.slice(deviceId.length + 2))
      out[handleId] = val
    }
    return out
  }

  const buildSlotsForDevice = (
    deviceId: string,
    nodeWidth: number,
    nodeHeight: number
  ): DiagramPortSlot[] => {
    const dev = deviceById.get(deviceId)
    if (!dev) return []
    const portCount = dev.data.portCount ?? dev.data.ports?.length ?? 0
    const preliminary = resolveDevicePortSlots({
      deviceId,
      ports: dev.data.ports ?? [],
      edges,
      layoutMode,
      portDisplay,
      portFlowInverted,
      savedAnchors: deviceAnchorsFor(deviceId),
    })
    const rows = portSlotsVerticalRows(preliminary)
    const portAreaTop = devicePortAreaTop(
      dev.label,
      rows,
      portCount,
      nodeWidth
    )
    return resolveDevicePortSlots({
      deviceId,
      ports: dev.data.ports ?? [],
      edges,
      layoutMode,
      portDisplay,
      portFlowInverted,
      savedAnchors: deviceAnchorsFor(deviceId),
      nodeHeight,
      portAreaTop,
    })
  }

  let autoX = 40
  let autoY = 40

  const onlyExistingDeviceIds = (ids: string[]) => ids.filter((id) => deviceById.has(id))

  const resolveRackDevices = (rackId: string, containerKey: string) => {
    const saved = containers[containerKey]
    const raw =
      saved?.deviceIds != null
        ? [...saved.deviceIds]
        : inventory.filter((d) => d.data.containerId === rackId).map((d) => d.id)
    return onlyExistingDeviceIds(raw)
  }

  const resolveBoardDevices = (boardId: string, containerKey: string) => {
    const saved = containers[containerKey]
    const raw =
      saved?.deviceIds != null
        ? [...saved.deviceIds]
        : inventory.filter((d) => d.data.containerId === boardId).map((d) => d.id)
    return onlyExistingDeviceIds(raw)
  }

  const resolveLooseAreaDevices = (areaId: string, containerKey: string) => {
    const saved = containers[containerKey]
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
    return onlyExistingDeviceIds(raw)
  }

  /** Equipos ya colocados en cualquier contenedor visible (orden-independiente). */
  const usedOnDiagram = new Set<string>()
  for (const area of areas) {
    const key = areaFlowNodeId(area.id)
    if (!visibleSet.has(key)) continue
    for (const did of resolveLooseAreaDevices(area.id, key)) {
      usedOnDiagram.add(did)
    }
  }
  for (const rack of racks) {
    const key = rackFlowNodeId(rack.id)
    if (!visibleSet.has(key)) continue
    for (const did of resolveRackDevices(rack.id, key)) {
      usedOnDiagram.add(did)
    }
  }
  for (const board of boards) {
    const key = boardFlowNodeId(board.id)
    if (!visibleSet.has(key)) continue
    for (const did of resolveBoardDevices(board.id, key)) {
      usedOnDiagram.add(did)
    }
  }

  const nodePositions = diagram.nodePositions ?? {}

  const pushDeviceNodes = (
    parentId: string | undefined,
    deviceIds: string[],
    heightById: Record<string, number>,
    widthById: Record<string, number>,
    positions: Record<string, { x: number; y: number }>,
    containerLabel: string
  ) => {
    for (const did of deviceIds) {
      if (shownDeviceIds.has(did)) continue
      const dev = deviceById.get(did)
      if (!dev) continue
      shownDeviceIds.add(did)
      shownContainerByDeviceId.set(did, containerLabel)
      const size = resolveDeviceNodeSize(heightById[did], {
        width: widthById[did],
        height: heightById[did],
      })
      const slots = buildSlotsForDevice(did, size.width, size.height)
      const deviceHandleAnchors: Record<string, DiagramHandleAnchor> = {}
      for (const slot of slots) {
        deviceHandleAnchors[slot.id] = slot.anchor
      }
      nodes.push({
        id: did,
        type: 'simpleDevice',
        ...(parentId
          ? { parentId, expandParent: true }
          : {}),
        draggable: deviceDraggable,
        position: positions[did] ?? {
          x: parentId ? CONTAINER_PAD : autoX,
          y: parentId ? rackBoardContentTop(sizeOpts) : autoY,
        },
        data: {
          label: dev.label,
          deviceType: dev.data.deviceType,
          ipAddress: dev.data.ipAddress,
          status: dev.data.status,
          portsInUse: usedPortsByDevice.get(did)?.size ?? 0,
          portCount: dev.data.portCount ?? dev.data.ports?.length ?? 0,
          accentColor: accentColorForNodeId(did),
          readOnly: readOnly || hidePicker,
          slots,
          handleAnchors: deviceHandleAnchors,
          onHandleAnchorChange:
            readOnly || hidePicker || !onHandleAnchorChange
              ? undefined
              : (handleId: string, anchor: DiagramHandleAnchor) =>
                  onHandleAnchorChange(did, handleId, anchor),
          onHandleAnchorChangeEnd:
            readOnly || hidePicker || !onHandleAnchorChangeEnd
              ? undefined
              : (handleId: string, anchor: DiagramHandleAnchor) =>
                  onHandleAnchorChangeEnd(did, handleId, anchor),
          onSlotsReorder:
            readOnly || hidePicker || !onSlotsReorder
              ? undefined
              : (nextSlots: DiagramPortSlot[]) => onSlotsReorder(did, nextSlots),
          onRedistributePorts:
            readOnly || hidePicker || !onRedistributePorts
              ? undefined
              : () => onRedistributePorts(did),
          onRemove:
            readOnly || hidePicker || !parentId
              ? undefined
              : () => onRemoveDeviceFromContainer?.(parentId, did),
          onPortClick:
            readOnly || hidePicker || !onPortClick
              ? undefined
              : (params: {
                  handleId: string
                  label: string
                  side: 'source' | 'target'
                }) => onPortClick({ deviceId: did, ...params }),
          onDeviceDoubleClick:
            readOnly || hidePicker || !onDeviceDoubleClick
              ? undefined
              : () => onDeviceDoubleClick(did),
        },
        style: {
          width: size.width,
          height: size.height,
        },
        width: size.width,
        height: size.height,
        zIndex: 3,
      })
      if (!parentId) {
        autoX += size.width + 48
        if (autoX > 1200) {
          autoX = 40
          autoY += size.height + 48
        }
      }
    }
  }

  const measureDeviceSize = (deviceId: string) => {
    const saved = nodePositions[deviceId]
    const dev = deviceById.get(deviceId)
    const nodeWidth =
      saved?.width && saved.width > 0 ? saved.width : SIMPLE_DEVICE_WIDTH
    const preliminary = dev
      ? resolveDevicePortSlots({
          deviceId,
          ports: dev.data.ports ?? [],
          edges,
          layoutMode,
          portDisplay,
          portFlowInverted,
          savedAnchors: deviceAnchorsFor(deviceId),
        })
      : []
    const rows = portSlotsVerticalRows(preliminary)
    const autoH = simpleDeviceHeight(
      rows,
      dev?.label ?? '',
      nodeWidth,
      preliminary.length > 0 && preliminary.every((s) => !s.connected)
    )
    return resolveDeviceNodeSize(autoH, saved)
  }

  const fillDeviceSizes = (deviceIds: string[]) => {
    const heightById: Record<string, number> = {}
    const widthById: Record<string, number> = {}
    for (const did of deviceIds) {
      const size = measureDeviceSize(did)
      heightById[did] = size.height
      widthById[did] = size.width
    }
    return { heightById, widthById }
  }

  const measureRack = (rack: TopologyRackSummary, id: string) => {
    const deviceIds = resolveRackDevices(rack.id, id)
    const { heightById, widthById } = fillDeviceSizes(deviceIds)
    const contentTop = rackBoardContentTop(sizeOpts)
    const bodyPad = CONTAINER_PAD
    const stackFallback = stackDevicePositions(deviceIds, heightById, sizeOpts)
    const positions = resolveContainerDevicePositions({
      deviceIds,
      heightById,
      nodePositions,
      stackFallback,
      contentTop,
      bodyPad,
      deviceGap,
    })
    const deviceRects = deviceIds.map((did) => ({
      x: positions[did].x,
      y: positions[did].y,
      width: widthById[did] ?? SIMPLE_DEVICE_WIDTH,
      height: heightById[did],
    }))
    const emptyFloor = emptyRackBoardFloorSize(sizeOpts)
    const contentMin = contentMinFromDeviceRects(
      deviceRects,
      contentTop,
      bodyPad,
      emptyFloor
    )
    const saved = containers[id]
    const size = {
      width: applySavedAreaExtent(
        contentMin.width,
        saved?.width,
        saved?.contentMinWidth
      ),
      height: applySavedAreaExtent(
        contentMin.height,
        saved?.height,
        saved?.contentMinHeight
      ),
    }
    return { deviceIds, heightById, widthById, size, contentMin, positions }
  }

  const measureBoard = (board: TopologyBoardSummary, id: string) => {
    const deviceIds = resolveBoardDevices(board.id, id)
    const { heightById, widthById } = fillDeviceSizes(deviceIds)
    const contentTop = rackBoardContentTop(sizeOpts)
    const bodyPad = CONTAINER_PAD
    const stackFallback = stackDevicePositions(deviceIds, heightById, sizeOpts)
    const positions = resolveContainerDevicePositions({
      deviceIds,
      heightById,
      nodePositions,
      stackFallback,
      contentTop,
      bodyPad,
      deviceGap,
    })
    const deviceRects = deviceIds.map((did) => ({
      x: positions[did].x,
      y: positions[did].y,
      width: widthById[did] ?? SIMPLE_DEVICE_WIDTH,
      height: heightById[did],
    }))
    const emptyFloor = emptyRackBoardFloorSize(sizeOpts)
    const contentMin = contentMinFromDeviceRects(
      deviceRects,
      contentTop,
      bodyPad,
      emptyFloor
    )
    const saved = containers[id]
    const size = {
      width: applySavedAreaExtent(
        contentMin.width,
        saved?.width,
        saved?.contentMinWidth
      ),
      height: applySavedAreaExtent(
        contentMin.height,
        saved?.height,
        saved?.contentMinHeight
      ),
    }
    return { deviceIds, heightById, widthById, size, contentMin, positions }
  }

  const pushRackNode = (
    rack: TopologyRackSummary,
    id: string,
    pos: { x: number; y: number },
    parentId: string | undefined,
    measured: ReturnType<typeof measureRack>
  ) => {
    const { deviceIds, heightById, widthById, size, contentMin, positions } = measured
    const deviceOptions = inventory.map((d) =>
      buildDevicePickerOption(d, usedOnDiagram.has(d.id)),
    )
    nodes.push({
      id,
      type: 'rackContainer',
      position: pos,
      parentId,
      expandParent: Boolean(parentId),
      draggable: deviceDraggable,
      dragHandle: '.rack-drag-handle',
      width: size.width,
      height: size.height,
      style: { width: size.width, height: size.height, overflow: 'visible' },
      data: {
        rack,
        containerId: rack.id,
        deviceIds,
        deviceOptions,
        contentMinWidth: contentMin.width,
        contentMinHeight: contentMin.height,
        readOnly,
        hidePicker,
        onAddDevice: (deviceId: string) => onAddDeviceToContainer?.(id, deviceId),
        onPickerOpenChange: (open: boolean) => onPickerOpenChange?.(id, open),
      },
      zIndex: parentId ? 2 : 1,
    })
    pushDeviceNodes(id, deviceIds, heightById, widthById, positions, rack.name)
  }

  const pushBoardNode = (
    board: TopologyBoardSummary,
    id: string,
    pos: { x: number; y: number },
    parentId: string | undefined,
    measured: ReturnType<typeof measureBoard>
  ) => {
    const { deviceIds, heightById, widthById, size, contentMin, positions } = measured
    const deviceOptions = inventory.map((d) =>
      buildDevicePickerOption(d, usedOnDiagram.has(d.id)),
    )
    nodes.push({
      id,
      type: 'boardContainer',
      position: pos,
      parentId,
      expandParent: Boolean(parentId),
      draggable: deviceDraggable,
      dragHandle: '.board-drag-handle',
      width: size.width,
      height: size.height,
      style: { width: size.width, height: size.height, overflow: 'visible' },
      data: {
        board,
        containerId: board.id,
        deviceIds,
        deviceOptions,
        contentMinWidth: contentMin.width,
        contentMinHeight: contentMin.height,
        readOnly,
        hidePicker,
        onAddDevice: (deviceId: string) => onAddDeviceToContainer?.(id, deviceId),
        onPickerOpenChange: (open: boolean) => onPickerOpenChange?.(id, open),
      },
      zIndex: parentId ? 2 : 1,
    })
    pushDeviceNodes(id, deviceIds, heightById, widthById, positions, board.name)
  }

  // —— Layout: free (containers) vs tree (flat devices) ——
  if (treeMode) {
    const treeDeviceIds = [...usedOnDiagram]
    const { heightById, widthById } = fillDeviceSizes(treeDeviceIds)
    const positions: Record<string, { x: number; y: number }> = {}
    for (const did of treeDeviceIds) {
      const saved = nodePositions[did]
      positions[did] = saved ? { x: saved.x, y: saved.y } : { x: autoX, y: autoY }
    }
    pushDeviceNodes(
      undefined,
      treeDeviceIds,
      heightById,
      widthById,
      positions,
      'Árbol'
    )
  } else {
  // —— Area containers (roots) with nested racks/boards + loose devices ——
  for (const area of areas) {
    const areaId = areaFlowNodeId(area.id)
    if (!visibleSet.has(areaId)) continue
    const savedArea = containers[areaId]

    const nestedRacks = racks.filter((rack) => {
      const id = rackFlowNodeId(rack.id)
      if (!visibleSet.has(id)) return false
      const saved = containers[id]
      return saved?.parentId === areaId
    })
    const nestedBoards = boards.filter((board) => {
      const id = boardFlowNodeId(board.id)
      if (!visibleSet.has(id)) return false
      const saved = containers[id]
      return saved?.parentId === areaId
    })

    const childSpecs: {
      id: string
      width: number
      height: number
      kind: 'rack' | 'board'
      rack?: TopologyRackSummary
      board?: TopologyBoardSummary
      measured: ReturnType<typeof measureRack> | ReturnType<typeof measureBoard>
    }[] = []

    for (const rack of nestedRacks) {
      const id = rackFlowNodeId(rack.id)
      nestedChildIds.add(id)
      const measured = measureRack(rack, id)
      childSpecs.push({
        id,
        width: measured.size.width,
        height: measured.size.height,
        kind: 'rack',
        rack,
        measured,
      })
    }
    for (const board of nestedBoards) {
      const id = boardFlowNodeId(board.id)
      nestedChildIds.add(id)
      const measured = measureBoard(board, id)
      childSpecs.push({
        id,
        width: measured.size.width,
        height: measured.size.height,
        kind: 'board',
        board,
        measured,
      })
    }

    childSpecs.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === 'rack' ? -1 : 1
      const an = a.rack?.name ?? a.board?.name ?? a.id
      const bn = b.rack?.name ?? b.board?.name ?? b.id
      return an.localeCompare(bn, 'es')
    })

    const looseDeviceIds = resolveLooseAreaDevices(area.id, areaId)
    const { heightById: looseHeightById, widthById: looseWidthById } =
      fillDeviceSizes(looseDeviceIds)
    const looseHeights = looseDeviceIds.map((did) => looseHeightById[did])

    const autoLayout = layoutAreaChildren(
      childSpecs.map((c) => ({ id: c.id, width: c.width, height: c.height })),
      looseHeights,
      sizeOpts
    )

    // Prefer saved manual positions for nested children; fallback to auto-pack.
    const minChildY = areaContentTop(sizeOpts)
    const childPositions: Record<string, { x: number; y: number }> = {}
    for (const spec of childSpecs) {
      const saved = containers[spec.id]
      const auto = autoLayout.childPositions[spec.id]
      if (
        saved?.parentId === areaId &&
        Number.isFinite(saved.x) &&
        Number.isFinite(saved.y)
      ) {
        childPositions[spec.id] = {
          x: Math.max(AREA_BODY_PAD, saved.x),
          y: Math.max(minChildY, saved.y),
        }
      } else {
        childPositions[spec.id] = auto ?? { x: AREA_BODY_PAD, y: minChildY }
      }
    }

    let contentMinW = autoLayout.width
    let contentMinH = autoLayout.height
    for (const spec of childSpecs) {
      const p = childPositions[spec.id]
      contentMinW = Math.max(contentMinW, p.x + spec.width + AREA_BODY_PAD)
      contentMinH = Math.max(contentMinH, p.y + spec.height + AREA_BODY_PAD)
    }
    // Include loose devices in min bounds (free XY)
    if (looseDeviceIds.length > 0) {
      const looseOrigin = areaLooseOrigin(childSpecs.length > 0, sizeOpts)
      const loosePositions = resolveContainerDevicePositions({
        deviceIds: looseDeviceIds,
        heightById: looseHeightById,
        nodePositions,
        stackFallback: stackLooseDevicePositions(
          looseDeviceIds,
          looseHeightById,
          autoLayout.looseOrigin,
          sizeOpts
        ),
        contentTop: looseOrigin.y,
        bodyPad: AREA_BODY_PAD,
        deviceGap,
      })
      for (const did of looseDeviceIds) {
        const p = loosePositions[did]
        contentMinW = Math.max(
          contentMinW,
          p.x + (looseWidthById[did] ?? SIMPLE_DEVICE_WIDTH) + AREA_BODY_PAD
        )
        contentMinH = Math.max(
          contentMinH,
          p.y + looseHeightById[did] + AREA_BODY_PAD
        )
      }
    }

    const areaW = applySavedAreaExtent(
      contentMinW,
      savedArea?.width,
      savedArea?.contentMinWidth
    )
    const areaH = applySavedAreaExtent(
      contentMinH,
      savedArea?.height,
      savedArea?.contentMinHeight
    )

    const areaPos = { x: savedArea?.x ?? autoX, y: savedArea?.y ?? autoY }
    autoX += areaW + 64
    if (autoX > 1100) {
      autoX = 40
      autoY += areaH + 64
    }

    const looseOptions = inventory
      .filter(
        (d) =>
          d.data.areaId === area.id &&
          (!d.data.containerId ||
            (!rackContainerIds.has(d.data.containerId) &&
              !boardContainerIds.has(d.data.containerId))),
      )
      .map((d) => buildDevicePickerOption(d, usedOnDiagram.has(d.id)))

    nodes.push({
      id: areaId,
      type: 'areaContainer',
      position: areaPos,
      dragHandle: '.area-drag-handle',
      draggable: deviceDraggable,
      width: areaW,
      height: areaH,
      style: { width: areaW, height: areaH, overflow: 'visible' },
      data: {
        area,
        deviceIds: looseDeviceIds,
        deviceOptions: looseOptions,
        hasSubContainers: childSpecs.length > 0,
        contentMinWidth: contentMinW,
        contentMinHeight: contentMinH,
        readOnly,
        hidePicker,
        onAddDevice: (deviceId: string) => onAddDeviceToContainer?.(areaId, deviceId),
        onPickerOpenChange: (open: boolean) => onPickerOpenChange?.(areaId, open),
      },
      zIndex: 0,
    })

    for (const spec of childSpecs) {
      const pos = childPositions[spec.id] ?? {
        x: AREA_BODY_PAD,
        y: areaContentTop(sizeOpts),
      }
      if (spec.kind === 'rack' && spec.rack) {
        pushRackNode(spec.rack, spec.id, pos, areaId, spec.measured as ReturnType<typeof measureRack>)
      } else if (spec.kind === 'board' && spec.board) {
        pushBoardNode(
          spec.board,
          spec.id,
          pos,
          areaId,
          spec.measured as ReturnType<typeof measureBoard>
        )
      }
    }

    const looseOrigin = areaLooseOrigin(childSpecs.length > 0, sizeOpts)
    const loosePositions = resolveContainerDevicePositions({
      deviceIds: looseDeviceIds,
      heightById: looseHeightById,
      nodePositions,
      stackFallback: stackLooseDevicePositions(
        looseDeviceIds,
        looseHeightById,
        autoLayout.looseOrigin,
        sizeOpts
      ),
      contentTop: looseOrigin.y,
      bodyPad: AREA_BODY_PAD,
      deviceGap,
    })
    pushDeviceNodes(
      areaId,
      looseDeviceIds,
      looseHeightById,
      looseWidthById,
      loosePositions,
      area.name
    )
  }

  // —— Legacy flat racks/boards (no parentId or parent area not on canvas) ——
  for (const rack of racks) {
    const id = rackFlowNodeId(rack.id)
    if (!visibleSet.has(id) || nestedChildIds.has(id)) continue
    const measured = measureRack(rack, id)
    const saved = containers[id]
    const pos = { x: saved?.x ?? autoX, y: saved?.y ?? autoY }
    autoX += measured.size.width + 48
    if (autoX > 900) {
      autoX = 40
      autoY += measured.size.height + 48
    }
    pushRackNode(rack, id, pos, undefined, measured)
  }

  for (const board of boards) {
    const id = boardFlowNodeId(board.id)
    if (!visibleSet.has(id) || nestedChildIds.has(id)) continue
    const measured = measureBoard(board, id)
    const saved = containers[id]
    const pos = { x: saved?.x ?? autoX, y: saved?.y ?? autoY + 80 }
    autoX += measured.size.width + 48
    pushBoardNode(board, id, pos, undefined, measured)
  }
  }

  const flowEdges: Edge<RoutedLinkEdgeData>[] = edges
    .filter((e) => shownDeviceIds.has(e.source) && shownDeviceIds.has(e.target))
    .map((e) => {
      const route = diagram.edgeRoutes?.[e.id]
      const labelOff = diagram.labelOffsets?.[e.id]
      const sourceLabel = formatEndpointLabel(
        e.source,
        e.sourcePort,
        inventory,
        shownContainerByDeviceId
      )
      const targetLabel = formatEndpointLabel(
        e.target,
        e.targetPort,
        inventory,
        shownContainerByDeviceId
      )
      return {
        id: e.id,
        type: 'routedLink' as const,
        source: e.source,
        target: e.target,
        sourceHandle: edgeHandleId(e.sourcePortId, e.sourcePort),
        targetHandle: edgeTargetHandleId(e.targetPortId, e.targetPort),
        zIndex: 1000,
        data: {
          code: e.code,
          sourcePort: e.sourcePort,
          targetPort: e.targetPort,
          sourcePortId: e.sourcePortId,
          targetPortId: e.targetPortId,
          sourceLabel,
          targetLabel,
          routePoints: route?.points,
          routeManual: route?.manual === true,
          labelOffsetX: labelOff?.x,
          labelOffsetY: labelOff?.y,
          labelPathT: labelOff?.t,
        },
      }
    })

  return { nodes, edges: flowEdges }
}

function resolveNodeHandleEndpoint(
  node: Node,
  handleId: string,
  role: 'source' | 'target',
  handleAnchors: Record<string, DiagramHandleAnchor>,
  absPos: { x: number; y: number }
) {
  const neutralId = legacyToNeutralHandleId(handleId.replace(/::in$/, ''))
  const w = Number(node.width ?? node.style?.width ?? SIMPLE_DEVICE_WIDTH)
  const h = Number(node.height ?? node.style?.height ?? 36)
  const slots = (node.data?.slots as DiagramPortSlot[] | undefined) ?? []
  const slot = slots.find((s) => s.id === neutralId)

  if (slot?.anchor) {
    return anchorToEndpoint(slot.anchor, absPos.x, absPos.y, w, h)
  }

  const label = (node.data?.label as string) ?? ''
  const portCount = (node.data?.portCount as number) ?? 0
  const rows = portSlotsVerticalRows(slots)
  const portAreaTop = devicePortAreaTop(label, rows, portCount, w)
  const nodeAnchors =
    (node.data?.handleAnchors as Record<string, DiagramHandleAnchor> | undefined) ?? {}
  const saved =
    handleAnchors[handleAnchorKey(node.id, neutralId)] ?? nodeAnchors[neutralId]
  const idx = slots.findIndex((s) => s.id === neutralId)
  const anchor =
    saved ??
    (idx >= 0
      ? defaultHandleAnchor(role, idx, Math.max(1, slots.length), h, portAreaTop)
      : {
          side: role === 'target' ? ('left' as const) : ('right' as const),
          t: 0.5,
        })
  return anchorToEndpoint(anchor, absPos.x, absPos.y, w, h)
}

function ConnectionDiagramCanvasInner(
  {
    inventory,
    edges: linkEdges,
    racks,
    boards,
    areas,
    visibleContainerIds,
    diagram,
    readOnly = false,
    paperSize = 'a4',
    printOrientation = 'landscape',
    showPrintMargins = false,
    printInvertColors = false,
    printFrame = null,
    printFrameLocked = false,
    onPrintFrameChange,
    onPrintFrameChangeEnd,
    onPrintDiagnostics,
    onStaleLinkIdsChange,
    onConnectDevices,
    onPortClick,
    onDeviceDoubleClick,
    onNavigateToLink,
    focusedLinkId = null,
    onFocusedLinkChange,
    onAddDeviceToContainer,
    onRemoveDeviceFromContainer,
    onReorderDevicesInContainer,
  }: Props,
  ref: React.Ref<ConnectionDiagramCanvasHandle>
) {
  const { theme } = useTheme()
  const colorMode: ColorMode = theme === 'dark' ? 'dark' : 'light'
  const callbacksRef = useRef({
    onAddDeviceToContainer,
    onRemoveDeviceFromContainer,
    onReorderDevicesInContainer,
    onPortClick,
    onDeviceDoubleClick,
    onFocusedLinkChange,
    onStaleLinkIdsChange,
    onPrintDiagnostics,
  })
  callbacksRef.current = {
    onAddDeviceToContainer,
    onRemoveDeviceFromContainer,
    onReorderDevicesInContainer,
    onPortClick,
    onDeviceDoubleClick,
    onFocusedLinkChange,
    onStaleLinkIdsChange,
    onPrintDiagnostics,
  }

  const [nodes, setNodes, onNodesChange] = useNodesState([] as Node[])
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    [] as Edge<RoutedLinkEdgeData>[]
  )
  /** Compacta contenedores sin buscador durante captura PDF. */
  const [hidePickerForPrint, setHidePickerForPrint] = useState(false)
  /** Oculta overlay naranja de márgenes durante captura PDF. */
  const [hideMarginsForCapture, setHideMarginsForCapture] = useState(false)
  const nodesRef = useRef(nodes)
  const edgesRef = useRef(edges)
  nodesRef.current = nodes
  edgesRef.current = edges
  const didFitRef = useRef(false)
  const shellElRef = useRef<HTMLDivElement | null>(null)
  const rfInstanceRef = useRef<ReactFlowInstance | null>(null)
  const focusedLinkIdRef = useRef(focusedLinkId)
  focusedLinkIdRef.current = focusedLinkId
  const deviceGap = resolveDeviceGap({ deviceGap: diagram.settings?.deviceGap })
  const prevDeviceGapRef = useRef(deviceGap)
  const [handleAnchors, setHandleAnchors] = useState<Record<string, DiagramHandleAnchor>>(
    () => diagram.handleAnchors ?? {}
  )
  const handleAnchorsRef = useRef(handleAnchors)
  handleAnchorsRef.current = handleAnchors
  const rerouteCablesRef = useRef<() => void>(() => {})
  const scheduleRerouteRef = useRef<() => void>(() => {})

  useEffect(() => {
    const next = normalizeHandleAnchorKeys(diagram.handleAnchors ?? {})
    handleAnchorsRef.current = next
    setHandleAnchors(next)
  }, [diagram.id])

  const handleAnchorChange = useCallback(
    (deviceId: string, handleId: string, anchor: DiagramHandleAnchor) => {
      const key = handleAnchorKey(deviceId, handleId)
      setHandleAnchors((prev) => {
        const next = { ...prev, [key]: anchor }
        handleAnchorsRef.current = next
        return next
      })
      setNodes((prev) =>
        prev.map((n) =>
          n.id === deviceId
            ? {
                ...n,
                data: {
                  ...n.data,
                  handleAnchors: {
                    ...((n.data?.handleAnchors as Record<string, DiagramHandleAnchor>) ??
                      {}),
                    [handleId]: anchor,
                  },
                },
              }
            : n
        )
      )
      scheduleRerouteRef.current()
    },
    [setNodes]
  )

  const handleAnchorChangeEnd = useCallback(
    (_deviceId: string, _handleId: string, _anchor: DiagramHandleAnchor) => {
      rerouteCablesRef.current()
    },
    []
  )

  const handleSlotsReorder = useCallback(
    (deviceId: string, slots: DiagramPortSlot[]) => {
      setHandleAnchors((prev) => {
        const next = { ...prev }
        for (const slot of slots) {
          next[handleAnchorKey(deviceId, slot.id)] = slot.anchor
        }
        handleAnchorsRef.current = next
        return next
      })
      setNodes((prev) =>
        prev.map((n) =>
          n.id === deviceId
            ? {
                ...n,
                data: {
                  ...n.data,
                  slots,
                  handleAnchors: Object.fromEntries(
                    slots.map((s) => [s.id, s.anchor])
                  ),
                },
              }
            : n
        )
      )
      scheduleRerouteRef.current()
    },
    [setNodes]
  )

  const handleRedistributePorts = useCallback((deviceId: string) => {
    setHandleAnchors((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${deviceId}::`)) delete next[key]
      }
      handleAnchorsRef.current = next
      return next
    })
    rerouteCablesRef.current()
  }, [])

  useEffect(() => {
    didFitRef.current = false
  }, [diagram.id])

  const handlePickerOpenChange = useCallback(
    (containerId: string, open: boolean) => {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === containerId ? { ...n, zIndex: open ? 50 : 1 } : n
        )
      )
    },
    [setNodes]
  )

  const built = useMemo(
    () =>
      buildGraph({
        inventory,
        edges: linkEdges,
        racks,
        boards,
        areas,
        visibleContainerIds,
        diagram,
        readOnly,
        hidePicker: hidePickerForPrint,
        onAddDeviceToContainer: (containerId, deviceId) =>
          callbacksRef.current.onAddDeviceToContainer?.(containerId, deviceId),
        onRemoveDeviceFromContainer: (containerId, deviceId) =>
          callbacksRef.current.onRemoveDeviceFromContainer?.(containerId, deviceId),
        onPickerOpenChange: handlePickerOpenChange,
        onPortClick: (params) => callbacksRef.current.onPortClick?.(params),
        onDeviceDoubleClick: (deviceId) =>
          callbacksRef.current.onDeviceDoubleClick?.(deviceId),
        handleAnchors,
        onHandleAnchorChange: handleAnchorChange,
        onHandleAnchorChangeEnd: handleAnchorChangeEnd,
        onSlotsReorder: handleSlotsReorder,
        onRedistributePorts: handleRedistributePorts,
      }),
    [
      inventory,
      linkEdges,
      racks,
      boards,
      areas,
      visibleContainerIds,
      diagram,
      readOnly,
      hidePickerForPrint,
      handlePickerOpenChange,
      handleAnchors,
      handleAnchorChange,
      handleAnchorChangeEnd,
      handleSlotsReorder,
      handleRedistributePorts,
    ]
  )

  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      return built.nodes.map((n) => {
        const existing = prevById.get(n.id)
        if (n.type === 'simpleDevice' && existing && existing.parentId === n.parentId) {
          const { width, height } = preserveDeviceExtent(n, existing)
          return {
            ...n,
            position: existing.position,
            selected: existing.selected,
            width,
            height,
            style: {
              ...n.style,
              width,
              height,
            },
            data: {
              ...n.data,
              handleAnchors: {
                ...((n.data?.handleAnchors as Record<string, DiagramHandleAnchor>) ?? {}),
                ...((existing.data?.handleAnchors as Record<string, DiagramHandleAnchor>) ??
                  {}),
              },
            },
          }
        }
        if (
          n.type === 'areaContainer' ||
          n.type === 'rackContainer' ||
          n.type === 'boardContainer'
        ) {
          // Roots: keep drag position. Containers keep unsaved manual resize,
          // but shrink when content (devices/racks) got smaller.
          // Nested racks/boards: keep manual drag position inside the area.
          if (existing && existing.parentId === n.parentId) {
            const { width, height } = preserveContainerExtent(n, existing)
            return {
              ...n,
              position: existing.position,
              selected: existing.selected,
              width,
              height,
              style: {
                ...n.style,
                width,
                height,
              },
              zIndex:
                existing.zIndex && existing.zIndex > 1 ? existing.zIndex : n.zIndex,
            }
          }
        }
        return n
      })
    })
    setEdges((prev) => {
      const prevById = new Map(prev.map((e) => [e.id, e]))
      const focusId = focusedLinkIdRef.current
      return built.edges.map((e) => {
        const old = prevById.get(e.id)
        const match = focusId != null && e.id === focusId
        const withReadOnly = {
          ...e,
          selected: match,
          zIndex: match ? 1002 : 1000,
          style: {
            ...e.style,
            opacity: focusId == null ? 1 : match ? 1 : 0.22,
          },
          data: {
            ...e.data,
            readOnly,
          },
        }
        if (
          old?.data?.routePoints?.length &&
          !(e.data?.routePoints && e.data.routePoints.length > 0)
        ) {
          return {
            ...withReadOnly,
            data: {
              ...withReadOnly.data,
              routePoints: old.data.routePoints,
              routeManual: old.data.routeManual === true,
            },
          }
        }
        // Keep in-session manual edits when the diagram payload still has auto routes.
        if (old?.data?.routeManual && old.data.routePoints?.length) {
          return {
            ...withReadOnly,
            data: {
              ...withReadOnly.data,
              routePoints: old.data.routePoints,
              routeManual: true,
            },
          }
        }
        return withReadOnly
      })
    })
  }, [built, readOnly, setNodes, setEdges])

  useEffect(() => {
    setEdges((eds) =>
      eds.map((e) => {
        const match = focusedLinkId != null && e.id === focusedLinkId
        return {
          ...e,
          selected: match,
          zIndex: match ? 1002 : 1000,
          style: {
            ...e.style,
            opacity: focusedLinkId == null ? 1 : match ? 1 : 0.22,
          },
        }
      })
    )
  }, [focusedLinkId, setEdges])

  const focusCameraOnLink = useCallback((edgeId: string) => {
    const instance = rfInstanceRef.current
    if (!instance) return
    const edge = edgesRef.current.find((e) => e.id === edgeId)
    if (!edge) return

    const points = edge.data?.routePoints
    if (points && points.length >= 2) {
      const xs = points.map((p) => p.x)
      const ys = points.map((p) => p.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      const width = Math.max(maxX - minX, 80)
      const height = Math.max(maxY - minY, 80)
      void instance.fitBounds(
        { x: minX - 40, y: minY - 40, width: width + 80, height: height + 80 },
        { padding: 0.25, duration: 280 }
      )
      return
    }

    void instance.fitView({
      nodes: [{ id: edge.source }, { id: edge.target }],
      padding: 0.35,
      duration: 280,
    })
  }, [])

  const selectLink = useCallback(
    (edgeId: string) => {
      callbacksRef.current.onFocusedLinkChange?.(edgeId)
      requestAnimationFrame(() => focusCameraOnLink(edgeId))
    },
    [focusCameraOnLink]
  )

  useEffect(() => {
    if (didFitRef.current || nodes.length === 0) return
    didFitRef.current = true
    requestAnimationFrame(() => rfInstanceRef.current?.fitView({ padding: 0.15 }))
  }, [nodes])

  const rerouteCables = useCallback(() => {
    const currentNodes = nodesRef.current
    const currentEdges = edgesRef.current

    const obstacles = collectRouteObstacles(currentNodes)
    const corridorYs = collectStackCorridorYs(currentNodes)

    const endpointByEdgeId: Record<
      string,
      {
        source: ReturnType<typeof resolveNodeHandleEndpoint>
        target: ReturnType<typeof resolveNodeHandleEndpoint>
      }
    > = {}
    const anchors = handleAnchorsRef.current
    const requests: DiagramRouteRequest[] = []
    for (const e of currentEdges) {
      const sourceAbs = absolutePos(currentNodes, e.source)
      const targetAbs = absolutePos(currentNodes, e.target)
      if (!sourceAbs || !targetAbs) continue
      const sourceNode = currentNodes.find((n) => n.id === e.source)
      const targetNode = currentNodes.find((n) => n.id === e.target)
      if (!sourceNode || !targetNode) continue

      const sourceHandleId = e.sourceHandle ?? DIAGRAM_CONNECT_SOURCE_HANDLE
      const targetHandleId = e.targetHandle ?? DIAGRAM_CONNECT_TARGET_HANDLE

      const endpoints = {
        source: resolveNodeHandleEndpoint(
          sourceNode,
          sourceHandleId,
          'source',
          anchors,
          sourceAbs
        ),
        target: resolveNodeHandleEndpoint(
          targetNode,
          targetHandleId,
          'target',
          anchors,
          targetAbs
        ),
      }
      endpointByEdgeId[e.id] = endpoints

      // Rutas editadas a mano: no pasar por A*; solo reanclar extremos.
      if (e.data?.routeManual && e.data.routePoints && e.data.routePoints.length >= 2) {
        continue
      }

      requests.push({
        id: e.id,
        source: endpoints.source,
        target: endpoints.target,
      })
    }

    const routes =
      requests.length > 0
        ? routeOrthogonalEdges(requests, obstacles, {
            laneSpacing: diagram.settings?.laneSpacing ?? 10,
            padding: 8,
            extraYs: corridorYs,
          })
        : {}

    for (const e of currentEdges) {
      if (!(e.data?.routeManual && e.data.routePoints && e.data.routePoints.length >= 2)) continue
      const ep = endpointByEdgeId[e.id]
      if (!ep) continue
      routes[e.id] = {
        points: repairManualRoute(e.data.routePoints, ep.source, ep.target),
      }
    }

    if (Object.keys(routes).length === 0 && currentEdges.length === 0) return

    const edgesWithRoutes = currentEdges.map((e) => ({
      id: e.id,
      routePoints: routes[e.id]?.points ?? e.data?.routePoints,
      labelOffsetX: e.data?.labelOffsetX,
      labelOffsetY: e.data?.labelOffsetY,
      labelPathT: e.data?.labelPathT,
    }))
    const labelObstacles = collectLabelObstacles(currentNodes)
    const labelOffsets = computeClearLabelOffsets(edgesWithRoutes, labelObstacles)

    const staleIds: string[] = []
    setEdges((prev) =>
      prev.map((e) => {
        const next = routes[e.id]?.points
        const off = labelOffsets[e.id]
        const points = next?.length ? next : e.data?.routePoints
        const manual = e.data?.routeManual === true
        const stale =
          manual && points && points.length >= 2
            ? isRouteStale(points, obstacles, { ignoreIds: [e.source, e.target] })
            : false
        if (stale) staleIds.push(e.id)
        if (!next?.length && !off && e.data?.routeStale === stale) return e
        return {
          ...e,
          data: {
            ...e.data,
            ...(next?.length ? { routePoints: next } : {}),
            routeManual: manual,
            routeStale: stale,
            labelOffsetX: off?.x ?? e.data?.labelOffsetX ?? 0,
            labelOffsetY: off?.y ?? e.data?.labelOffsetY ?? 0,
            labelPathT: off?.t ?? e.data?.labelPathT,
          },
        }
      })
    )
    callbacksRef.current.onStaleLinkIdsChange?.(staleIds)
  }, [diagram.settings?.laneSpacing, setEdges])

  useEffect(() => {
    if (prevDeviceGapRef.current === deviceGap) return
    prevDeviceGapRef.current = deviceGap
    const t = window.setTimeout(() => rerouteCables(), 120)
    return () => window.clearTimeout(t)
  }, [deviceGap, rerouteCables])

  const captureDiagramPng = useCallback(
    async (
      format: PaperFormat,
      orientation: PrintOrientation,
      invertColors = false,
    ): Promise<CapturedDiagram | null> => {
      const shell = shellElRef.current
      if (!shell) return null

      // Snapshot del layout del usuario — la captura no reubica contenedores.
      const snapshotNodes = cloneFlowNodes(nodesRef.current)
      const snapshotEdges = cloneFlowEdges(edgesRef.current)

      const restore = () => {
        setNodes(snapshotNodes)
        nodesRef.current = snapshotNodes
        setEdges(snapshotEdges)
        edgesRef.current = snapshotEdges
        setHidePickerForPrint(false)
        setHideMarginsForCapture(false)
      }

      try {
        setHidePickerForPrint(true)
        setHideMarginsForCapture(true)
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => setTimeout(r, 100))

        rerouteCables()
        await new Promise<void>((r) => setTimeout(r, 100))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        // Reubicar etiquetas de enlaces fuera de contenedores / equipos.
        const obstacles = collectLabelObstacles(nodesRef.current)
        const offsets = computeClearLabelOffsets(
          edgesRef.current.map((e) => ({
            id: e.id,
            routePoints: e.data?.routePoints,
            labelOffsetX: e.data?.labelOffsetX,
            labelOffsetY: e.data?.labelOffsetY,
            labelPathT: e.data?.labelPathT,
          })),
          obstacles,
        )
        setEdges((prev) => {
          const next = prev.map((e) => {
            const off = offsets[e.id]
            if (!off) return e
            return {
              ...e,
              data: {
                ...e.data,
                labelOffsetX: off.x,
                labelOffsetY: off.y,
                labelPathT: off.t,
              },
            }
          })
          edgesRef.current = next
          return next
        })
        await new Promise<void>((r) => setTimeout(r, 60))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        const planned = printFrame
          ? planFromFrame(printFrame, format, orientation)
          : planFromNodes(nodesRef.current, orientation, format)
        if (!planned) return null

        const { plan, bounds } = planned
        const vp = getCaptureViewport(bounds, plan.cssW, plan.cssH)
        if (!Number.isFinite(vp.zoom) || vp.zoom <= 0) return null

        // Quitar filtro CSS de preview para evitar doble inversión; el post-proceso PNG lo aplica.
        const hadInvertClass = invertColors && shell.classList.contains('diagram-print-invert')
        if (hadInvertClass) {
          shell.classList.remove('diagram-print-invert')
          await new Promise<void>((r) => requestAnimationFrame(() => r()))
        }

        let imgData: string
        try {
          imgData = await captureReactFlowViewport({
            canvasElement: shell,
            cssW: plan.cssW,
            cssH: plan.cssH,
            pixelRatio: plan.pixelRatio,
            viewport: { x: vp.x, y: vp.y, zoom: vp.zoom },
            invertColors,
          })
        } finally {
          if (hadInvertClass) {
            shell.classList.add('diagram-print-invert')
          }
        }

        const img = new Image()
        img.src = imgData
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Captura PNG inválida'))
        })

        return {
          imgData,
          imgW: img.naturalWidth || plan.imgW,
          imgH: img.naturalHeight || plan.imgH,
          plan,
        }
      } finally {
        restore()
        await new Promise<void>((r) => requestAnimationFrame(() => r()))
        await new Promise<void>((r) => setTimeout(r, 40))
      }
    },
    [printFrame, rerouteCables, setNodes, setEdges]
  )

  useImperativeHandle(
    ref,
    () => ({
      rerouteCables,
      selectLink,
      captureDiagramPng,
      getContentBounds: () => {
        const top = getTopLevelVisibleNodes(nodesRef.current)
        if (top.length === 0) return null
        const bounds = getNodesBounds(top)
        if (!(bounds.width > 0) || !(bounds.height > 0)) return null
        return bounds
      },
      getStaleLinkIds: () =>
        edgesRef.current
          .filter((e) => e.data?.routeStale === true)
          .map((e) => e.id),
      autorouteLinks: (edgeIds) => {
        if (!edgeIds.length) return
        const idSet = new Set(edgeIds)
        const next = edgesRef.current.map((e) =>
          idSet.has(e.id)
            ? {
                ...e,
                data: {
                  ...e.data,
                  routeManual: false,
                  routeStale: false,
                },
              }
            : e,
        )
        edgesRef.current = next
        setEdges(next)
        rerouteCables()
      },
      getPersistPayload: (printSettings) => {
        const nodePositions: Record<string, DiagramNodePosition> = {}
        const containers: Record<
          string,
          {
            x: number
            y: number
            view?: 'front' | 'rear' | 'both'
            collapsed?: boolean
            deviceIds?: string[]
            parentId?: string | null
            width?: number
            height?: number
            contentMinWidth?: number
            contentMinHeight?: number
          }
        > = { ...(diagram.containers ?? {}) }
        const edgeRoutes: Record<string, { points: { x: number; y: number }[]; manual?: boolean }> =
          {}
        const labelOffsets: Record<string, { x: number; y: number; t?: number }> = {}

        for (const n of nodesRef.current) {
          if (
            n.type === 'areaContainer' ||
            n.type === 'rackContainer' ||
            n.type === 'boardContainer'
          ) {
            const prev = containers[n.id] ?? { x: n.position.x, y: n.position.y }
            const w = Number(n.width ?? n.style?.width ?? prev.width ?? 0)
            const h = Number(n.height ?? n.style?.height ?? prev.height ?? 0)
            const contentMinW = Number(
              (n.data as { contentMinWidth?: number })?.contentMinWidth ?? prev.contentMinWidth ?? 0
            )
            const contentMinH = Number(
              (n.data as { contentMinHeight?: number })?.contentMinHeight ??
                prev.contentMinHeight ??
                0
            )
            containers[n.id] = {
              ...prev,
              x: n.position.x,
              y: n.position.y,
              parentId: n.parentId ?? prev.parentId ?? null,
              deviceIds:
                (n.data as { deviceIds?: string[] })?.deviceIds ?? prev.deviceIds ?? [],
              ...(w > 0 ? { width: w } : {}),
              ...(h > 0 ? { height: h } : {}),
              ...(contentMinW > 0 ? { contentMinWidth: contentMinW } : {}),
              ...(contentMinH > 0 ? { contentMinHeight: contentMinH } : {}),
            }
          } else if (n.type === 'simpleDevice') {
            const size = flowNodeSize(n)
            nodePositions[n.id] = {
              x: n.position.x,
              y: n.position.y,
              ...(size.width > 0 ? { width: Math.round(size.width) } : {}),
              ...(size.height > 0 ? { height: Math.round(size.height) } : {}),
            }
          } else if (!n.parentId) {
            nodePositions[n.id] = { x: n.position.x, y: n.position.y }
          }
        }
        for (const e of edgesRef.current) {
          if (e.data?.routePoints?.length) {
            edgeRoutes[e.id] = {
              points: e.data.routePoints,
              ...(e.data.routeManual ? { manual: true } : {}),
            }
          }
          if (
            e.data?.labelOffsetX != null ||
            e.data?.labelOffsetY != null ||
            e.data?.labelPathT != null
          ) {
            labelOffsets[e.id] = {
              x: e.data.labelOffsetX ?? 0,
              y: e.data.labelOffsetY ?? 0,
              ...(e.data.labelPathT != null
                ? { t: Math.min(1, Math.max(0, e.data.labelPathT)) }
                : {}),
            }
          }
        }
        const settings: DiagramSettings = {
          ...(diagram.settings ?? {}),
          ...(printSettings?.paperSize ? { paperSize: printSettings.paperSize } : {}),
          ...(printSettings?.printOrientation
            ? { printOrientation: printSettings.printOrientation }
            : {}),
          ...(printSettings?.printFrame
            ? { printFrame: printSettings.printFrame }
            : printFrame
              ? { printFrame }
              : {}),
          ...(printSettings?.printIncludeLegend != null
            ? { printIncludeLegend: printSettings.printIncludeLegend }
            : {}),
          ...(printSettings?.printIncludeLinkTable != null
            ? { printIncludeLinkTable: printSettings.printIncludeLinkTable }
            : {}),
          ...(printSettings?.printInvertColors != null
            ? { printInvertColors: printSettings.printInvertColors }
            : {}),
        }
        return {
          nodePositions,
          labelOffsets,
          edgeRoutes,
          containers,
          settings,
          handleAnchors: normalizeHandleAnchorKeys({ ...handleAnchorsRef.current }),
          layoutMode: diagram.layoutMode ?? 'free',
        }
      },
    }),
    [
      rerouteCables,
      selectLink,
      captureDiagramPng,
      diagram.containers,
      diagram.settings,
      printFrame,
      setEdges,
    ]
  )

  useEffect(() => {
    if (edges.length === 0 || nodes.length === 0) return
    const t = window.setTimeout(() => rerouteCables(), 80)
    return () => window.clearTimeout(t)
  }, [edges.length, nodes.length, diagram.id, linkEdges, rerouteCables])

  /** Keep orthogonal routes stuck to device handles while containers move. */
  const dragRerouteRaf = useRef<number | null>(null)
  const scheduleRerouteDuringDrag = useCallback(() => {
    if (dragRerouteRaf.current != null) return
    dragRerouteRaf.current = window.requestAnimationFrame(() => {
      dragRerouteRaf.current = null
      rerouteCables()
    })
  }, [rerouteCables])

  useEffect(() => {
    rerouteCablesRef.current = rerouteCables
    scheduleRerouteRef.current = scheduleRerouteDuringDrag
  }, [rerouteCables, scheduleRerouteDuringDrag])

  useEffect(() => {
    return () => {
      if (dragRerouteRaf.current != null) {
        window.cancelAnimationFrame(dragRerouteRaf.current)
      }
    }
  }, [])

  /** Merge only the dragged node position — never replace the full node list
   *  (RF's 3rd arg can omit children → absolutePos falls back to 0,0). */
  const syncDraggedNodePosition = useCallback((node: Node) => {
    nodesRef.current = nodesRef.current.map((n) =>
      n.id === node.id ? { ...n, position: node.position } : n
    )
  }, [])

  const onNodeDrag = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (node.parentId && node.type === 'simpleDevice') {
        const withMin = clampDeviceNodeMinInParent(
          node,
          nodesRef.current,
          hidePickerForPrint
        )
        let next = nodesRef.current.map((n) =>
          n.id === node.id ? { ...n, position: withMin.position } : n
        )
        const dragged = next.find((n) => n.id === node.id) ?? withMin
        next = expandAncestorsToFit(dragged, next, hidePickerForPrint)
        nodesRef.current = next
        setNodes(next)
        scheduleRerouteDuringDrag()
        return
      }

      // Subcontenedores dentro del área: no tapar el encabezado del área.
      if (
        node.parentId &&
        (node.type === 'rackContainer' || node.type === 'boardContainer')
      ) {
        const minY = areaContentTop({ hidePicker: hidePickerForPrint })
        const clamped = {
          ...node,
          position: {
            x: Math.max(AREA_BODY_PAD, node.position.x),
            y: Math.max(minY, node.position.y),
          },
        }
        syncDraggedNodePosition(clamped)
        setNodes((prev) =>
          prev.map((n) =>
            n.id === node.id ? { ...n, position: clamped.position } : n
          )
        )
        scheduleRerouteDuringDrag()
        return
      }

      syncDraggedNodePosition(node)
      scheduleRerouteDuringDrag()
    },
    [
      hidePickerForPrint,
      scheduleRerouteDuringDrag,
      setNodes,
      syncDraggedNodePosition,
    ]
  )

  const onNodeDragStop = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (dragRerouteRaf.current != null) {
        window.cancelAnimationFrame(dragRerouteRaf.current)
        dragRerouteRaf.current = null
      }

      if (node.parentId && node.type === 'simpleDevice') {
        const withMin = clampDeviceNodeMinInParent(
          node,
          nodesRef.current,
          hidePickerForPrint
        )
        let next = nodesRef.current.map((n) =>
          n.id === node.id ? { ...n, position: withMin.position } : n
        )
        const dragged = next.find((n) => n.id === node.id) ?? withMin
        next = expandAncestorsToFit(dragged, next, hidePickerForPrint)
        nodesRef.current = next
        setNodes(next)
        rerouteCables()
        return
      }

      if (
        node.parentId &&
        (node.type === 'rackContainer' || node.type === 'boardContainer')
      ) {
        const minY = areaContentTop({ hidePicker: hidePickerForPrint })
        const clamped = {
          ...node,
          position: {
            x: Math.max(AREA_BODY_PAD, node.position.x),
            y: Math.max(minY, node.position.y),
          },
        }
        syncDraggedNodePosition(clamped)
        setNodes((prev) =>
          prev.map((n) =>
            n.id === node.id ? { ...n, position: clamped.position } : n
          )
        )
        rerouteCables()
        return
      }

      syncDraggedNodePosition(node)
      rerouteCables()
    },
    [
      hidePickerForPrint,
      rerouteCables,
      setNodes,
      syncDraggedNodePosition,
    ]
  )

  const onNodesChangeWithResize = useCallback(
    (changes: Parameters<typeof onNodesChange>[0]) => {
      onNodesChange(changes)
      const resizeEnded = changes.some(
        (c) => c.type === 'dimensions' && 'resizing' in c && c.resizing === false
      )
      if (resizeEnded) {
        setNodes((prev) => {
          let next = prev
          for (const c of changes) {
            if (c.type !== 'dimensions' || !('id' in c)) continue
            const resized = next.find((n) => n.id === c.id)
            if (
              resized?.type === 'areaContainer' ||
              resized?.type === 'rackContainer' ||
              resized?.type === 'boardContainer'
            ) {
              next = clampChildrenInParent(next, c.id, hidePickerForPrint)
            } else if (resized?.type === 'simpleDevice') {
              next = next.map((n) =>
                n.id === c.id
                  ? clampDeviceSizeInParent(n, next, hidePickerForPrint)
                  : n
              )
            }
          }
          nodesRef.current = next
          return next
        })
        window.setTimeout(() => rerouteCables(), 40)
      }
    },
    [hidePickerForPrint, onNodesChange, rerouteCables, setNodes]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !onConnectDevices) return
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return
      const stripIn = (h: string | null | undefined) =>
        h?.replace(/::in$/, '') ?? null
      onConnectDevices({
        sourceDeviceId: connection.source,
        targetDeviceId: connection.target,
        sourceHandle: stripIn(connection.sourceHandle),
        targetHandle: stripIn(connection.targetHandle),
      })
    },
    [onConnectDevices, readOnly]
  )

  const onInit = useCallback(
    (instance: ReactFlowInstance) => {
      rfInstanceRef.current = instance
      if (didFitRef.current || nodesRef.current.length === 0) return
      didFitRef.current = true
      requestAnimationFrame(() => instance.fitView({ padding: 0.15 }))
    },
    []
  )

  return (
    <div
      ref={shellElRef}
      className={`h-full w-full${printInvertColors ? ' diagram-print-invert' : ''}`}
    >
      <ReactFlow
        className="h-full w-full"
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChangeWithResize}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode={colorMode}
        connectionMode={ConnectionMode.Loose}
        onConnect={onConnect}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgeClick={(_e, edge) => {
          callbacksRef.current.onFocusedLinkChange?.(edge.id)
        }}
        onEdgeDoubleClick={(_e, edge) => onNavigateToLink?.(edge.id)}
        onPaneClick={() => {
          callbacksRef.current.onFocusedLinkChange?.(null)
        }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable
        minZoom={0.15}
        maxZoom={1.5}
        defaultEdgeOptions={{ type: 'routedLink', zIndex: 1000 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="!bg-transparent"
        />
        <Controls className="!overflow-hidden !rounded-lg !border !border-slate-200 !bg-white !shadow-md dark:!border-slate-600 dark:!bg-slate-900" />
        <MiniMap
          pannable
          zoomable
          className="!overflow-hidden !rounded-lg !border !border-slate-200 !bg-white/90 !shadow-md dark:!border-slate-600 dark:!bg-slate-900/95"
          maskColor={theme === 'dark' ? 'rgba(15, 23, 42, 0.7)' : 'rgba(15, 23, 42, 0.08)'}
          nodeStrokeWidth={2}
        />
        <PrintFrameOverlay
          enabled={showPrintMargins && !hideMarginsForCapture}
          frame={printFrame}
          orientation={printOrientation}
          format={paperSize}
          locked={printFrameLocked}
          readOnly={readOnly}
          onFrameChange={onPrintFrameChange}
          onFrameChangeEnd={onPrintFrameChangeEnd}
          onDiagnostics={onPrintDiagnostics}
        />
      </ReactFlow>
    </div>
  )
}

const ConnectionDiagramCanvasForward = forwardRef(ConnectionDiagramCanvasInner)

export function ConnectionDiagramCanvas(
  props: Props & { canvasRef?: React.Ref<ConnectionDiagramCanvasHandle> }
) {
  const { canvasRef, ...rest } = props
  return (
    <ReactFlowProvider>
      <ConnectionDiagramCanvasForward ref={canvasRef} {...rest} />
    </ReactFlowProvider>
  )
}
