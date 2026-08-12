import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  ConnectionMode,
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
  areaContentTop,
  layoutAreaChildren,
  stackLooseDevicePositions,
} from './AreaContainerNode'
import { BoardContainerNode } from './BoardContainerNode'
import {
  RackContainerNode,
  rackContainerSize,
  reorderDeviceIdsByY,
  stackDevicePositions,
} from './RackContainerNode'
import { RoutedLinkEdge, type RoutedLinkEdgeData } from './RoutedLinkEdge'
import {
  SimpleDeviceNode,
  simpleDeviceHeight,
  SIMPLE_DEVICE_WIDTH,
  SIMPLE_DEVICE_NAME_ROW_H,
  CONTAINER_PAD,
  CONTAINER_HEADER_H,
  CONTAINER_SELECTOR_H,
} from './SimpleDeviceNode'
import { accentColorForNodeId } from '../../utils/topologyAccent'
import { areaFlowNodeId } from '../../utils/areaPlacement'
import { boardFlowNodeId } from '../../utils/boardPlacement'
import { rackFlowNodeId } from '../../utils/topologyRackLayout'
import {
  routeOrthogonalEdges,
  type DiagramRect,
  type DiagramRouteRequest,
} from '../../utils/diagram/orthogonalRouter'
import { reattachOrthogonalEnds } from '../../utils/diagram/orthogonalRouteEdit'
import { computeClearLabelOffsets } from '../../utils/diagram/edgeLabelPlacement'
import { formatEndpointLabel } from '../../utils/diagram/linkLabel'
import {
  DIAGRAM_CONNECT_SOURCE_HANDLE,
  DIAGRAM_CONNECT_TARGET_HANDLE,
  diagramHandleCenterY,
  diagramSourceHandleId,
  diagramTargetHandleId,
  type DiagramPortHandle,
} from '../../utils/diagram/diagramPortHandles'
import {
  captureReactFlowViewport,
  type CapturedDiagram,
} from '../../utils/pdf/diagramCapturePdf'
import {
  getCaptureViewport,
  planFromNodes,
} from '../../utils/printDiagramSectorGrid'
import type { PaperFormat, PrintOrientation } from '../../utils/pdf/a4Geometry'
import { PrintSectorBoundsOverlay } from '../topology/PrintSectorBoundsOverlay'
import type {
  ConnectionDiagram,
  DiagramLinkEdge,
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
  ) => Promise<CapturedDiagram | null>
  getPersistPayload: (printSettings?: Pick<DiagramSettings, 'paperSize' | 'printOrientation'>) => {
    nodePositions: Record<string, { x: number; y: number }>
    labelOffsets: Record<string, { y: number; x: number }>
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
      }
    >
    settings: DiagramSettings
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
  onConnectDevices?: (params: {
    sourceDeviceId: string
    targetDeviceId: string
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
    },
  }))
}

function collectLabelObstacles(nodes: Node[]) {
  const obstacles: { x: number; y: number; width: number; height: number }[] = []
  for (const n of nodes) {
    // Área = contenedor hueco: no bloquear etiquetas/rutas en su interior.
    if (n.type === 'areaContainer') continue
    const abs = absolutePos(nodes, n.id)
    if (!abs) continue
    const w = Number(n.style?.width ?? n.width ?? 200)
    const h = Number(n.style?.height ?? n.height ?? 80)
    obstacles.push({ x: abs.x, y: abs.y, width: w, height: h })
  }
  return obstacles
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
  } = params
  const deviceDraggable = !readOnly && !hidePicker
  const nodes: Node[] = []
  const containers = diagram.containers ?? {}
  const visibleSet = new Set(visibleContainerIds)
  const sizeOpts = { hidePicker }

  const deviceById = new Map(inventory.map((d) => [d.id, d]))
  const shownDeviceIds = new Set<string>()
  const shownContainerByDeviceId = new Map<string, string>()
  const nestedChildIds = new Set<string>()

  /** Solo puertos con al menos un diagram_link en este canvas. */
  const sourcePortsByDevice = new Map<string, DiagramPortHandle[]>()
  const targetPortsByDevice = new Map<string, DiagramPortHandle[]>()
  /** Puertos únicos usados por diagram_links (por equipo). */
  const usedPortsByDevice = new Map<string, Set<string>>()

  const pushUniquePort = (
    byDevice: Map<string, DiagramPortHandle[]>,
    deviceId: string,
    handle: DiagramPortHandle
  ) => {
    let list = byDevice.get(deviceId)
    if (!list) {
      list = []
      byDevice.set(deviceId, list)
    }
    if (list.some((p) => p.id === handle.id)) return
    list.push(handle)
  }

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
    pushUniquePort(sourcePortsByDevice, e.source, {
      id: diagramSourceHandleId(e.sourcePortId, e.sourcePort),
      label: e.sourcePort,
    })
    pushUniquePort(targetPortsByDevice, e.target, {
      id: diagramTargetHandleId(e.targetPortId, e.targetPort),
      label: e.targetPort,
    })
    markPortUsed(e.source, e.sourcePortId, e.sourcePort)
    markPortUsed(e.target, e.targetPortId, e.targetPort)
  }

  const connectedSlotsFor = (deviceId: string) =>
    Math.max(
      sourcePortsByDevice.get(deviceId)?.length ?? 0,
      targetPortsByDevice.get(deviceId)?.length ?? 0
    )

  let autoX = 40
  let autoY = 40

  const resolveRackDevices = (rackId: string, containerKey: string) => {
    const saved = containers[containerKey]
    return saved?.deviceIds != null
      ? [...saved.deviceIds]
      : inventory.filter((d) => d.data.rackId === rackId).map((d) => d.id)
  }

  const resolveBoardDevices = (boardId: string, containerKey: string) => {
    const saved = containers[containerKey]
    return saved?.deviceIds != null
      ? [...saved.deviceIds]
      : inventory.filter((d) => d.data.boardId === boardId).map((d) => d.id)
  }

  const resolveLooseAreaDevices = (areaId: string, containerKey: string) => {
    const saved = containers[containerKey]
    return saved?.deviceIds != null
      ? [...saved.deviceIds]
      : inventory
          .filter(
            (d) =>
              d.data.areaId === areaId && !d.data.rackId && !d.data.boardId
          )
          .map((d) => d.id)
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

  const pushDeviceNodes = (
    parentId: string,
    deviceIds: string[],
    heightById: Record<string, number>,
    stack: Record<string, { x: number; y: number }>,
    containerLabel: string
  ) => {
    for (const did of deviceIds) {
      if (shownDeviceIds.has(did)) continue
      const dev = deviceById.get(did)
      if (!dev) continue
      shownDeviceIds.add(did)
      shownContainerByDeviceId.set(did, containerLabel)
      nodes.push({
        id: did,
        type: 'simpleDevice',
        parentId,
        extent: 'parent',
        expandParent: false,
        draggable: deviceDraggable,
        position: stack[did] ?? {
          x: CONTAINER_PAD,
          y: CONTAINER_HEADER_H + (hidePicker ? 0 : CONTAINER_SELECTOR_H),
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
          sourcePorts: sourcePortsByDevice.get(did) ?? [],
          targetPorts: targetPortsByDevice.get(did) ?? [],
          onRemove:
            readOnly || hidePicker
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
          width: SIMPLE_DEVICE_WIDTH,
          height: heightById[did],
        },
        zIndex: 3,
      })
    }
  }

  const measureDeviceHeight = (deviceId: string) =>
    simpleDeviceHeight(
      connectedSlotsFor(deviceId),
      deviceById.get(deviceId)?.label ?? ''
    )

  const measureRack = (rack: TopologyRackSummary, id: string) => {
    const deviceIds = resolveRackDevices(rack.id, id)
    const heightById: Record<string, number> = {}
    const heights: number[] = []
    for (const did of deviceIds) {
      const h = measureDeviceHeight(did)
      heightById[did] = h
      heights.push(h)
    }
    return { deviceIds, heightById, size: rackContainerSize(heights, sizeOpts) }
  }

  const measureBoard = (board: TopologyBoardSummary, id: string) => {
    const deviceIds = resolveBoardDevices(board.id, id)
    const heightById: Record<string, number> = {}
    const heights: number[] = []
    for (const did of deviceIds) {
      const h = measureDeviceHeight(did)
      heightById[did] = h
      heights.push(h)
    }
    return { deviceIds, heightById, size: rackContainerSize(heights, sizeOpts) }
  }

  const pushRackNode = (
    rack: TopologyRackSummary,
    id: string,
    pos: { x: number; y: number },
    parentId: string | undefined,
    measured: ReturnType<typeof measureRack>
  ) => {
    const { deviceIds, heightById, size } = measured
    const deviceOptions = inventory.map((d) => ({
      id: d.id,
      label: d.label,
      name: d.label,
      deviceType: d.data.deviceType,
      ipAddress: d.data.ipAddress,
      alreadyIn: usedOnDiagram.has(d.id),
    }))
    nodes.push({
      id,
      type: 'rackContainer',
      position: pos,
      parentId,
      extent: parentId ? 'parent' : undefined,
      expandParent: false,
      draggable: deviceDraggable,
      style: { width: size.width, height: size.height, overflow: 'hidden' },
      data: {
        rack,
        deviceIds,
        deviceOptions,
        readOnly,
        hidePicker,
        onAddDevice: (deviceId: string) => onAddDeviceToContainer?.(id, deviceId),
        onPickerOpenChange: (open: boolean) => onPickerOpenChange?.(id, open),
      },
      zIndex: parentId ? 2 : 1,
    })
    const stack = stackDevicePositions(deviceIds, heightById, sizeOpts)
    pushDeviceNodes(id, deviceIds, heightById, stack, rack.name)
  }

  const pushBoardNode = (
    board: TopologyBoardSummary,
    id: string,
    pos: { x: number; y: number },
    parentId: string | undefined,
    measured: ReturnType<typeof measureBoard>
  ) => {
    const { deviceIds, heightById, size } = measured
    const deviceOptions = inventory.map((d) => ({
      id: d.id,
      label: d.label,
      name: d.label,
      deviceType: d.data.deviceType,
      ipAddress: d.data.ipAddress,
      alreadyIn: usedOnDiagram.has(d.id),
    }))
    nodes.push({
      id,
      type: 'boardContainer',
      position: pos,
      parentId,
      extent: parentId ? 'parent' : undefined,
      expandParent: false,
      draggable: deviceDraggable,
      style: { width: size.width, height: size.height, overflow: 'hidden' },
      data: {
        board,
        deviceIds,
        deviceOptions,
        readOnly,
        hidePicker,
        onAddDevice: (deviceId: string) => onAddDeviceToContainer?.(id, deviceId),
        onPickerOpenChange: (open: boolean) => onPickerOpenChange?.(id, open),
      },
      zIndex: parentId ? 2 : 1,
    })
    const stack = stackDevicePositions(deviceIds, heightById, sizeOpts)
    pushDeviceNodes(id, deviceIds, heightById, stack, board.name)
  }

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

    const looseHeightById: Record<string, number> = {}
    const looseHeights: number[] = []
    for (const did of looseDeviceIds) {
      const h = measureDeviceHeight(did)
      looseHeightById[did] = h
      looseHeights.push(h)
    }

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
    // Include loose devices origin in min bounds
    if (looseHeights.length > 0) {
      const body =
        looseHeights.reduce((s, h) => s + h, 0) +
        Math.max(0, looseHeights.length - 1) * 8
      contentMinW = Math.max(
        contentMinW,
        autoLayout.looseOrigin.x + SIMPLE_DEVICE_WIDTH + 8 + AREA_BODY_PAD
      )
      contentMinH = Math.max(
        contentMinH,
        autoLayout.looseOrigin.y + body + AREA_BODY_PAD
      )
    }

    const areaW = Math.max(contentMinW, savedArea?.width ?? contentMinW)
    const areaH = Math.max(contentMinH, savedArea?.height ?? contentMinH)

    const areaPos = { x: savedArea?.x ?? autoX, y: savedArea?.y ?? autoY }
    autoX += areaW + 64
    if (autoX > 1100) {
      autoX = 40
      autoY += areaH + 64
    }

    const looseOptions = inventory
      .filter(
        (d) =>
          d.data.areaId === area.id && !d.data.rackId && !d.data.boardId
      )
      .map((d) => ({
        id: d.id,
        label: d.label,
        name: d.label,
        deviceType: d.data.deviceType,
        ipAddress: d.data.ipAddress,
        alreadyIn: usedOnDiagram.has(d.id),
      }))

    nodes.push({
      id: areaId,
      type: 'areaContainer',
      position: areaPos,
      dragHandle: '.area-drag-handle',
      draggable: deviceDraggable,
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

    const looseStack = stackLooseDevicePositions(
      looseDeviceIds,
      looseHeightById,
      autoLayout.looseOrigin
    )
    pushDeviceNodes(areaId, looseDeviceIds, looseHeightById, looseStack, area.name)
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
        sourceHandle: diagramSourceHandleId(e.sourcePortId, e.sourcePort),
        targetHandle: diagramTargetHandleId(e.targetPortId, e.targetPort),
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
        },
      }
    })

  return { nodes, edges: flowEdges }
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
  })
  callbacksRef.current = {
    onAddDeviceToContainer,
    onRemoveDeviceFromContainer,
    onReorderDevicesInContainer,
    onPortClick,
    onDeviceDoubleClick,
    onFocusedLinkChange,
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
    ]
  )

  useEffect(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]))
      return built.nodes.map((n) => {
        if (
          n.type === 'areaContainer' ||
          n.type === 'rackContainer' ||
          n.type === 'boardContainer'
        ) {
          const existing = prevById.get(n.id)
          // Roots: keep drag position + manual size.
          // Nested racks/boards: keep manual drag position inside the area.
          if (
            existing &&
            !n.parentId &&
            existing.parentId === n.parentId
          ) {
            const builtW = Number(n.style?.width ?? 0)
            const builtH = Number(n.style?.height ?? 0)
            const prevW = Number(existing.style?.width ?? existing.width ?? 0)
            const prevH = Number(existing.style?.height ?? existing.height ?? 0)
            return {
              ...n,
              position: existing.position,
              selected: existing.selected,
              style: {
                ...n.style,
                width: Math.max(builtW, prevW) || builtW,
                height: Math.max(builtH, prevH) || builtH,
              },
              zIndex: existing.zIndex && existing.zIndex > 1 ? existing.zIndex : n.zIndex,
            }
          }
          if (existing && n.parentId && existing.parentId === n.parentId) {
            return {
              ...n,
              position: existing.position,
              selected: existing.selected,
              zIndex: existing.zIndex && existing.zIndex > 1 ? existing.zIndex : n.zIndex,
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

    const obstacles: DiagramRect[] = []
    for (const n of currentNodes) {
      // Área hueca: si se incluye, los cables intra-área no encuentran grid libre.
      if (n.type === 'areaContainer') continue
      const abs = absolutePos(currentNodes, n.id)
      if (!abs) continue
      const w = Number(n.style?.width ?? n.width ?? 200)
      const h = Number(n.style?.height ?? n.height ?? 80)
      obstacles.push({ id: n.id, x: abs.x, y: abs.y, width: w, height: h })
    }

    const endpointByEdgeId: Record<
      string,
      { source: { x: number; y: number; side: 'right' }; target: { x: number; y: number; side: 'left' } }
    > = {}
    const requests: DiagramRouteRequest[] = []
    for (const e of currentEdges) {
      const sourceAbs = absolutePos(currentNodes, e.source)
      const targetAbs = absolutePos(currentNodes, e.target)
      if (!sourceAbs || !targetAbs) continue
      const sourceNode = currentNodes.find((n) => n.id === e.source)
      const targetNode = currentNodes.find((n) => n.id === e.target)
      const sh = Number(sourceNode?.height ?? sourceNode?.style?.height ?? 36)
      const th = Number(targetNode?.height ?? targetNode?.style?.height ?? 36)
      const sw = Number(sourceNode?.width ?? sourceNode?.style?.width ?? SIMPLE_DEVICE_WIDTH)

      const sourcePorts =
        (sourceNode?.data?.sourcePorts as DiagramPortHandle[] | undefined) ?? []
      const targetPorts =
        (targetNode?.data?.targetPorts as DiagramPortHandle[] | undefined) ?? []
      const sourceHandleId = e.sourceHandle ?? DIAGRAM_CONNECT_SOURCE_HANDLE
      const targetHandleId = e.targetHandle ?? DIAGRAM_CONNECT_TARGET_HANDLE
      const sourceIdx = sourcePorts.findIndex((p) => p.id === sourceHandleId)
      const targetIdx = targetPorts.findIndex((p) => p.id === targetHandleId)
      const sourcePortAreaTop = sourcePorts.length > 0 ? SIMPLE_DEVICE_NAME_ROW_H : 0
      const targetPortAreaTop = targetPorts.length > 0 ? SIMPLE_DEVICE_NAME_ROW_H : 0
      const sourceY =
        sourceIdx >= 0
          ? sourcePortAreaTop +
            diagramHandleCenterY(
              sourceIdx,
              sourcePorts.length,
              Math.max(1, sh - sourcePortAreaTop)
            )
          : sh / 2
      const targetY =
        targetIdx >= 0
          ? targetPortAreaTop +
            diagramHandleCenterY(
              targetIdx,
              targetPorts.length,
              Math.max(1, th - targetPortAreaTop)
            )
          : th / 2

      const endpoints = {
        source: {
          x: sourceAbs.x + sw,
          y: sourceAbs.y + sourceY,
          side: 'right' as const,
        },
        target: {
          x: targetAbs.x,
          y: targetAbs.y + targetY,
          side: 'left' as const,
        },
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
            padding: 14,
          })
        : {}

    for (const e of currentEdges) {
      if (!(e.data?.routeManual && e.data.routePoints && e.data.routePoints.length >= 2)) continue
      const ep = endpointByEdgeId[e.id]
      if (!ep) continue
      routes[e.id] = {
        points: reattachOrthogonalEnds(e.data.routePoints, ep.source, ep.target),
      }
    }

    if (Object.keys(routes).length === 0 && currentEdges.length === 0) return

    const edgesWithRoutes = currentEdges.map((e) => ({
      id: e.id,
      routePoints: routes[e.id]?.points ?? e.data?.routePoints,
      labelOffsetX: undefined as number | undefined,
      labelOffsetY: undefined as number | undefined,
    }))
    const labelObstacles = collectLabelObstacles(currentNodes)
    const labelOffsets = computeClearLabelOffsets(edgesWithRoutes, labelObstacles)

    setEdges((prev) =>
      prev.map((e) => {
        const next = routes[e.id]?.points
        const off = labelOffsets[e.id]
        if (!next?.length && !off) return e
        return {
          ...e,
          data: {
            ...e.data,
            ...(next?.length ? { routePoints: next } : {}),
            // Preserve manual flag; autoroute never clears it here.
            routeManual: e.data?.routeManual === true,
            labelOffsetX: off?.x ?? 0,
            labelOffsetY: off?.y ?? 0,
          },
        }
      })
    )
  }, [diagram.settings?.laneSpacing, setEdges])

  const captureDiagramPng = useCallback(
    async (
      format: PaperFormat,
      orientation: PrintOrientation,
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
              },
            }
          })
          edgesRef.current = next
          return next
        })
        await new Promise<void>((r) => setTimeout(r, 60))
        await new Promise<void>((r) => requestAnimationFrame(() => r()))

        const planned = planFromNodes(nodesRef.current, orientation, format)
        if (!planned) return null

        const { plan, bounds } = planned
        const vp = getCaptureViewport(bounds, plan.cssW, plan.cssH)
        if (!Number.isFinite(vp.zoom) || vp.zoom <= 0) return null

        const imgData = await captureReactFlowViewport({
          canvasElement: shell,
          cssW: plan.cssW,
          cssH: plan.cssH,
          pixelRatio: plan.pixelRatio,
          viewport: { x: vp.x, y: vp.y, zoom: vp.zoom },
        })

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
    [rerouteCables, setNodes, setEdges]
  )

  useImperativeHandle(
    ref,
    () => ({
      rerouteCables,
      selectLink,
      captureDiagramPng,
      getPersistPayload: (printSettings) => {
        const nodePositions: Record<string, { x: number; y: number }> = {}
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
          }
        > = { ...(diagram.containers ?? {}) }
        const edgeRoutes: Record<string, { points: { x: number; y: number }[]; manual?: boolean }> =
          {}
        const labelOffsets: Record<string, { x: number; y: number }> = {}

        for (const n of nodesRef.current) {
          if (
            n.type === 'areaContainer' ||
            n.type === 'rackContainer' ||
            n.type === 'boardContainer'
          ) {
            const prev = containers[n.id] ?? { x: n.position.x, y: n.position.y }
            const w = Number(n.style?.width ?? n.width ?? prev.width ?? 0)
            const h = Number(n.style?.height ?? n.height ?? prev.height ?? 0)
            containers[n.id] = {
              ...prev,
              x: n.position.x,
              y: n.position.y,
              parentId: n.parentId ?? prev.parentId ?? null,
              deviceIds:
                (n.data as { deviceIds?: string[] })?.deviceIds ?? prev.deviceIds ?? [],
              ...(n.type === 'areaContainer' && w > 0 ? { width: w } : {}),
              ...(n.type === 'areaContainer' && h > 0 ? { height: h } : {}),
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
          if (e.data?.labelOffsetX != null || e.data?.labelOffsetY != null) {
            labelOffsets[e.id] = {
              x: e.data.labelOffsetX ?? 0,
              y: e.data.labelOffsetY ?? 0,
            }
          }
        }
        const settings: DiagramSettings = {
          ...(diagram.settings ?? {}),
          ...(printSettings?.paperSize ? { paperSize: printSettings.paperSize } : {}),
          ...(printSettings?.printOrientation
            ? { printOrientation: printSettings.printOrientation }
            : {}),
        }
        return { nodePositions, labelOffsets, edgeRoutes, containers, settings }
      },
    }),
    [rerouteCables, selectLink, captureDiagramPng, diagram.containers, diagram.settings]
  )

  useEffect(() => {
    if (edges.length === 0 || nodes.length === 0) return
    const t = window.setTimeout(() => rerouteCables(), 80)
    return () => window.clearTimeout(t)
  }, [edges.length, nodes.length, diagram.id, linkEdges, rerouteCables])

  /** Keep orthogonal routes stuck to device handles while containers move. */
  const dragRerouteRaf = useRef<number | null>(null)
  const deviceDragStartOrderRef = useRef<{
    containerId: string
    deviceIds: string[]
  } | null>(null)
  const scheduleRerouteDuringDrag = useCallback(() => {
    if (dragRerouteRaf.current != null) return
    dragRerouteRaf.current = window.requestAnimationFrame(() => {
      dragRerouteRaf.current = null
      rerouteCables()
    })
  }, [rerouteCables])

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

  const applyDeviceStackInContainer = useCallback(
    (
      allNodes: Node[],
      containerId: string,
      deviceIds: string[],
      opts: { hidePicker: boolean; draggedId?: string; draggedY?: number }
    ): Node[] => {
      const heightById: Record<string, number> = {}
      for (const id of deviceIds) {
        const child = allNodes.find((n) => n.id === id)
        heightById[id] = Number(
          child?.style?.height ?? child?.height ?? simpleDeviceHeight(0)
        )
      }
      const sizeOpts = { hidePicker: opts.hidePicker }
      const stack = stackDevicePositions(deviceIds, heightById, sizeOpts)
      const heights = deviceIds.map((id) => heightById[id] ?? simpleDeviceHeight(0))
      const size = rackContainerSize(heights, sizeOpts)

      return allNodes.map((n) => {
        if (n.id === containerId) {
          if (n.type === 'areaContainer') {
            return {
              ...n,
              data: { ...n.data, deviceIds },
            }
          }
          return {
            ...n,
            data: { ...n.data, deviceIds },
            style: { ...n.style, width: size.width, height: size.height },
          }
        }
        if (n.parentId !== containerId || n.type !== 'simpleDevice') return n
        if (opts.draggedId && n.id === opts.draggedId && opts.draggedY != null) {
          return {
            ...n,
            position: { x: CONTAINER_PAD, y: opts.draggedY },
          }
        }
        const pos = stack[n.id]
        if (!pos) return n
        return { ...n, position: pos }
      })
    },
    []
  )

  const onNodeDrag = useCallback(
    (_event: ReactMouseEvent, node: Node) => {
      if (node.parentId && node.type === 'simpleDevice') {
        const pinnedY = node.position.y
        const parent = nodesRef.current.find((n) => n.id === node.parentId)
        const deviceIds = (parent?.data as { deviceIds?: string[] })?.deviceIds
        if (deviceIds?.length) {
          if (
            !deviceDragStartOrderRef.current ||
            deviceDragStartOrderRef.current.containerId !== node.parentId
          ) {
            deviceDragStartOrderRef.current = {
              containerId: node.parentId,
              deviceIds: [...deviceIds],
            }
          }
          const baseIds = deviceDragStartOrderRef.current.deviceIds
          const heightById: Record<string, number> = {}
          for (const id of baseIds) {
            const child = nodesRef.current.find((n) => n.id === id)
            heightById[id] = Number(
              child?.style?.height ?? child?.height ?? simpleDeviceHeight(0)
            )
          }
          const nextIds = reorderDeviceIdsByY(
            baseIds,
            heightById,
            node.id,
            pinnedY,
            { hidePicker: hidePickerForPrint }
          )
          const next = applyDeviceStackInContainer(
            nodesRef.current,
            node.parentId,
            nextIds,
            {
              hidePicker: hidePickerForPrint,
              draggedId: node.id,
              draggedY: pinnedY,
            }
          )
          nodesRef.current = next
          setNodes(next)
          scheduleRerouteDuringDrag()
          return
        }
        const pinned = { ...node, position: { x: CONTAINER_PAD, y: pinnedY } }
        syncDraggedNodePosition(pinned)
        setNodes((prev) =>
          prev.map((n) =>
            n.id === node.id ? { ...n, position: pinned.position } : n
          )
        )
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
      applyDeviceStackInContainer,
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
        const start = deviceDragStartOrderRef.current
        deviceDragStartOrderRef.current = null
        const baseIds =
          start?.containerId === node.parentId
            ? start.deviceIds
            : (nodesRef.current.find((n) => n.id === node.parentId)?.data as {
                deviceIds?: string[]
              })?.deviceIds

        if (baseIds?.length) {
          const heightById: Record<string, number> = {}
          for (const id of baseIds) {
            const child = nodesRef.current.find((n) => n.id === id)
            heightById[id] = Number(
              child?.style?.height ?? child?.height ?? simpleDeviceHeight(0)
            )
          }
          const nextIds = reorderDeviceIdsByY(
            baseIds,
            heightById,
            node.id,
            node.position.y,
            { hidePicker: hidePickerForPrint }
          )
          const next = applyDeviceStackInContainer(
            nodesRef.current,
            node.parentId,
            nextIds,
            { hidePicker: hidePickerForPrint }
          )
          nodesRef.current = next
          setNodes(next)
          const changed = nextIds.some((id, i) => id !== baseIds[i])
          if (changed) {
            callbacksRef.current.onReorderDevicesInContainer?.(
              node.parentId,
              nextIds
            )
          }
          rerouteCables()
          return
        }
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
      applyDeviceStackInContainer,
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
        window.setTimeout(() => rerouteCables(), 40)
      }
    },
    [onNodesChange, rerouteCables]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (readOnly || !onConnectDevices) return
      if (!connection.source || !connection.target) return
      if (connection.source === connection.target) return
      onConnectDevices({
        sourceDeviceId: connection.source,
        targetDeviceId: connection.target,
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
    <div ref={shellElRef} className="h-full w-full">
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
        <PrintSectorBoundsOverlay
          enabled={showPrintMargins && !hideMarginsForCapture}
          orientation={printOrientation}
          format={paperSize}
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
