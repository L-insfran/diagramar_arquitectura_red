import {
  Handle,
  NodeResizer,
  Position,
  useNodeId,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { Wifi } from 'lucide-react'
import { Fragment, useContext, useLayoutEffect } from 'react'
import { TopologyCanvasInteractionContext } from './TopologyCanvasContext'
import type { TopologyNetworkSummary, TopologyPortSummary, TopologyVlanSummary } from '../../types'
import {
  PORT_GAP,
  PORT_PANEL_PADDING,
  PORT_PANEL_HEADER_HEIGHT,
  PORT_DOT_OVERFLOW,
  PATCH_PANEL_COLS,
  PORT_ROW_LABEL_HEIGHT,
  TOPOLOGY_HEADER_HEIGHT,
  TOPOLOGY_HEADER_HEIGHT_PATCH,
  WIFI_GAP,
  WIFI_PANEL_HEADER_HEIGHT,
  WIFI_SECTION_GAP,
  ETHERNET_FACEPLATE_BLOCK_SIZE,
  computePortPanelLayout,
  computeRackMountedPortPanelLayout,
  computePortConnectAnchor,
  computePortSourceAnchor,
  computePortTargetAnchor,
  faceplateColumnOffsetX,
  isCompactPortPanel,
  isStructuredCablingDeviceType,
  partitionDiagramPorts,
  abbreviatePortName,
  fitRackPortLabel,
  portCellClasses,
  portCellVisualScale,
  portConnectSourceHandleId,
  portConnectTargetHandleId,
  portFaceConnectable,
  portFaceConnected,
  portGridSlot,
  portSourceHandleId,
  portTargetHandleId,
  rackPortLabel,
  shouldUseEthernetFaceplateLayout,
  sortTopologyPorts,
  filterPortsForRackViewFace,
  usesEthernetFaceplateLayout,
  usesPhysicalPortLayout,
  wifiChipClasses,
  type PortPanelSection,
} from '../../utils/topologyPortPanel'
import { clampNodeScale, NODE_SCALE_MAX, NODE_SCALE_MIN } from '../../utils/topologyNodeScale'

export type DeviceNodeData = {
  label: string
  hostname: string | null
  ipAddress: string | null
  status: string
  accentColor: string
  location: string | null
  deviceType: string | null
  manufacturer?: string | null
  model?: string | null
  siteId?: string | null
  areaId?: string | null
  rackId?: string | null
  rackUnitStart?: number | null
  rackFace?: 'front' | 'rear' | 'both' | null
  rackUnits?: number
  isFullDepth?: boolean
  /** Cara activa del rack padre (para filtrar puertos por chassis_face). */
  rackViewFace?: 'front' | 'rear' | 'both'
  supportedByAccessoryId?: string | null
  shelfSlotStart?: number | null
  shelfWidthSlots?: number | null
  shelfHeightU?: number | null
  /** Equipo montado dentro de un rack del canvas (variante compacta). */
  rackMounted?: boolean
  vlanCount?: number
  vlans?: TopologyVlanSummary[]
  networks?: TopologyNetworkSummary[]
  portCount?: number
  portsInUse?: number
  ports?: TopologyPortSummary[]
  nodeWidth?: number
  nodeHeight?: number
  /** Escala visual respecto al tamaño natural del layout (1 = tamaño por defecto). */
  nodeScale?: number
  totalPortCount?: number
}

export type DeviceFlowNodeType = Node<DeviceNodeData, 'device'>

function formatVlanTooltip(vlans: TopologyVlanSummary[] | undefined): string {
  if (!vlans?.length) return 'Sin VLANs asignadas'
  return vlans
    .map((v) => `VLAN ${v.vlanId} · ${v.name}${v.isTagged ? ' (tagged)' : ''}`)
    .join('\n')
}

function portIsConnectable(port: TopologyPortSummary, readOnly: boolean): boolean {
  if (port.isPassthrough) {
    return portFaceConnectable(port, 'front', readOnly) || portFaceConnectable(port, 'rear', readOnly)
  }
  const chassis = port.chassisFace === 'rear' ? 'rear' : 'front'
  return portFaceConnectable(port, chassis, readOnly)
}

function PortCell({
  port,
  cellW,
  cellH,
  compact,
  rackMounted,
  faceplate,
  selected,
  onSelect,
  connectable,
}: {
  port: TopologyPortSummary
  cellW: number
  cellH: number
  compact: boolean
  rackMounted?: boolean
  /** Patch panel Ethernet: etiqueta numérica densa sin chrome de rack. */
  faceplate?: boolean
  selected: boolean
  onSelect: (portId: string) => void
  connectable: boolean
}) {
  const displayName = port.name?.trim() || String(port.portNumber)
  const frontOn = portFaceConnected(port, 'front')
  const rearOn = port.isPassthrough
    ? portFaceConnected(port, 'rear')
    : port.chassisFace === 'rear'
      ? portFaceConnected(port, 'rear')
      : false
  const anyConnected = frontOn || rearOn || port.connected
  const density = rackMounted ? 'rack' : 'default'
  const denseLabel = rackMounted || !!faceplate
  const scale = portCellVisualScale(port.portType)
  const visualW = Math.max(6, Math.round(cellW * scale))
  const visualH = Math.max(6, Math.round(cellH * scale))
  // Faceplate: número grande y legible. Rack/bandeja: encoger fuente hasta que entre el nombre.
  const fitted = faceplate
    ? {
        label: rackPortLabel(port, { preferNumber: true }),
        fontSize: Math.max(
          7,
          Math.min(
            12,
            Math.floor(Math.min(visualW * 0.62, visualH * 0.48, visualW >= 18 ? 11 : 9)),
          ),
        ),
      }
    : denseLabel
      ? fitRackPortLabel(displayName, visualW, visualH)
      : compact
        ? { label: abbreviatePortName(displayName, 10), fontSize: 11 }
        : { label: displayName, fontSize: 8 }
  const { label, fontSize } = fitted

  return (
    <button
      type="button"
      className={`nodrag nopan relative box-border flex flex-col items-center justify-center overflow-hidden border leading-none transition ${
        rackMounted || faceplate ? 'rounded-[2px]' : 'rounded'
      } ${portCellClasses(port, density)} ${
        rackMounted || faceplate ? 'px-px' : compact ? 'gap-0.5 px-1 py-1' : 'px-0.5'
      } ${
        selected
          ? rackMounted
            ? 'z-20 ring-1 ring-amber-400/90'
            : 'z-20 ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
          : ''
      } ${
        anyConnected
          ? 'cursor-pointer hover:brightness-110'
          : connectable
            ? 'pointer-events-none cursor-crosshair'
            : 'cursor-default'
      }`}
      style={{
        width: visualW,
        height: visualH,
        minWidth: visualW,
        maxWidth: visualW,
        minHeight: visualH,
        maxHeight: visualH,
      }}
      title={
        port.isPassthrough
          ? `Puerto ${port.portNumber} · ${displayName} · ${port.status} · R:${rearOn ? '●' : '○'} F:${frontOn ? '●' : '○'}${
              connectable
                ? ' · libre · arrastrá desde una cara libre'
                : anyConnected
                  ? ' · clic para navegar'
                  : ''
            }`
          : anyConnected
            ? `Puerto ${port.portNumber} · ${displayName} · ${port.status} · clic para ir al dispositivo conectado`
            : connectable
              ? `Puerto ${port.portNumber} · ${displayName} · ${port.status} · libre · arrastrá a otro puerto libre para enlazar`
              : `Puerto ${port.portNumber} · ${displayName} · ${port.status}`
      }
      onClick={(e) => {
        e.stopPropagation()
        if (anyConnected) onSelect(port.id)
      }}
    >
      {denseLabel ? (
        <span
          className={`max-w-full text-center font-semibold opacity-95 ${
            faceplate ? 'font-mono tabular-nums' : 'font-sans'
          }`}
          style={{
            fontSize,
            lineHeight: 1,
            letterSpacing: faceplate
              ? '-0.02em'
              : label.length >= 5
                ? '-0.04em'
                : '-0.01em',
            ...(faceplate
              ? {
                  overflow: 'hidden',
                  whiteSpace: 'nowrap' as const,
                }
              : {
                  overflow: 'visible',
                  whiteSpace: 'nowrap' as const,
                  transform: label.length >= 8 && visualW < 28 ? 'scaleX(0.92)' : undefined,
                  transformOrigin: 'center',
                }),
          }}
        >
          {label}
        </span>
      ) : compact ? (
        <>
          <span className="max-w-full truncate text-center text-[11px] font-semibold leading-none tracking-tight">
            {label}
          </span>
          <span className="text-[8px] font-medium tabular-nums leading-none opacity-60">
            #{port.portNumber}
          </span>
        </>
      ) : (
        <span className="max-w-full truncate text-center text-[8px] font-semibold leading-none tracking-tight">
          {label}
        </span>
      )}
      {port.isPassthrough ? (
        <span
          className={`absolute bottom-0 left-1/2 flex -translate-x-1/2 ${
            denseLabel ? 'translate-y-0 gap-px pb-px' : 'translate-y-1/2 gap-1'
          }`}
          aria-hidden
        >
          <span
            className={`${denseLabel ? 'h-0.5 w-1.5' : 'size-1.5'} rounded-full ring-1 ring-white dark:ring-gray-900 ${
              rearOn
                ? 'bg-violet-600'
                : port.status === 'up'
                  ? 'bg-sky-400/50'
                  : 'bg-gray-300 dark:bg-gray-600'
            }`}
            title="Rear"
          />
          <span
            className={`${denseLabel ? 'h-0.5 w-1.5' : 'size-1.5'} rounded-full ring-1 ring-white dark:ring-gray-900 ${
              frontOn
                ? 'bg-blue-600'
                : port.status === 'up'
                  ? 'bg-sky-400/50'
                  : 'bg-gray-300 dark:bg-gray-600'
            }`}
            title="Front"
          />
        </span>
      ) : (
        <>
          {!denseLabel && anyConnected && (
            <span
              className="absolute bottom-0 left-1/2 size-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-blue-600 ring-1 ring-white dark:ring-gray-900"
              aria-hidden
            />
          )}
          {denseLabel && (anyConnected || port.status === 'up') && (
            <span
              className={`absolute inset-x-0 bottom-0 h-0.5 ${
                anyConnected
                  ? port.status === 'up'
                    ? 'bg-emerald-400/80'
                    : 'bg-amber-400/70'
                  : 'bg-sky-400/55'
              }`}
              aria-hidden
            />
          )}
        </>
      )}
    </button>
  )
}

function WifiChip({
  port,
  cellW,
  cellH,
  selected,
  onSelect,
  connectable,
}: {
  port: TopologyPortSummary
  cellW: number
  cellH: number
  selected: boolean
  onSelect: (portId: string) => void
  connectable: boolean
}) {
  const displayName = port.name?.trim() || `SSID #${port.portNumber}`

  return (
    <button
      type="button"
      className={`nodrag nopan relative box-border flex items-center gap-1.5 rounded-full border px-2.5 leading-none transition ${wifiChipClasses(port)} ${
        selected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900 z-20' : ''
      } ${
        port.connected
          ? 'cursor-pointer hover:brightness-110'
          : connectable
            ? 'pointer-events-none cursor-crosshair'
            : 'cursor-default'
      }`}
      style={{ width: cellW, height: cellH, minWidth: cellW, maxWidth: cellW, minHeight: cellH, maxHeight: cellH }}
      title={
        port.connected
          ? `WiFi · ${displayName} · clic para ir al dispositivo conectado`
          : connectable
            ? `WiFi · ${displayName} · arrastrá a otro puerto libre para enlazar`
            : `WiFi · ${displayName}`
      }
      onClick={(e) => {
        e.stopPropagation()
        if (port.connected) onSelect(port.id)
      }}
    >
      <Wifi className="size-3.5 shrink-0 opacity-80" aria-hidden strokeWidth={2.25} />
      <span className="min-w-0 flex-1 truncate text-left text-[10px] font-bold tracking-tight">
        {displayName}
      </span>
      {port.connected && (
        <span
          className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 size-1.5 rounded-full bg-sky-500 ring-1 ring-white dark:ring-gray-900"
          aria-hidden
        />
      )}
    </button>
  )
}

export function DeviceFlowNode({ data, selected, width, height }: NodeProps<DeviceFlowNodeType>) {
  const nodeId = useNodeId()
  const updateNodeInternals = useUpdateNodeInternals()
  const interaction = useContext(TopologyCanvasInteractionContext)
  const readOnly = interaction?.readOnly ?? false
  const goDevice = interaction?.onNavigateToDevice
  const selection = interaction?.selection ?? null
  const highlightedPortIds = interaction?.highlightedPortIds
  const selectPort = interaction?.selectPort

  const rackMounted = !!data.rackMounted
  const isShelfMounted = rackMounted && !!data.supportedByAccessoryId
  const isRearMounted =
    rackMounted &&
    !isShelfMounted &&
    (data.rackFace === 'rear' || (!!data.isFullDepth && data.rackViewFace === 'rear'))
  const isFullDepthMounted = rackMounted && (!!data.isFullDepth || data.rackFace === 'both')

  const allPorts = sortTopologyPorts(
    rackMounted
      ? filterPortsForRackViewFace(data.ports ?? [], data.rackViewFace)
      : (data.ports ?? []),
  )
  const { physical: physicalPorts, wireless: wirelessPorts } = partitionDiagramPorts(allPorts)
  const layoutHints = {
    deviceType: data.deviceType,
    ports: allPorts,
    ...(data.supportedByAccessoryId ? { shelfMounted: true as const } : {}),
  }
  const isPatchPanel =
    isStructuredCablingDeviceType(data.deviceType) ||
    shouldUseEthernetFaceplateLayout(data.deviceType, allPorts)
  const freeHeaderHeight = isPatchPanel ? TOPOLOGY_HEADER_HEIGHT_PATCH : TOPOLOGY_HEADER_HEIGHT
  const totalPhysicalCount =
    data.totalPortCount != null
      ? Math.max(0, data.totalPortCount - wirelessPorts.length)
      : physicalPorts.length
  const compact = isCompactPortPanel(physicalPorts.length, totalPhysicalCount)
  const hasPhysical = physicalPorts.length > 0
  const hasWireless = wirelessPorts.length > 0
  const hasPorts = hasPhysical || hasWireless

  const slotW = typeof width === 'number' && width > 0 ? width : data.nodeWidth ?? 380
  const slotH = typeof height === 'number' && height > 0 ? height : data.nodeHeight ?? 44

  const layout = rackMounted
    ? computeRackMountedPortPanelLayout(
        physicalPorts.length,
        totalPhysicalCount,
        wirelessPorts.length,
        slotW,
        slotH,
        layoutHints,
      )
    : computePortPanelLayout(
        physicalPorts.length,
        compact,
        totalPhysicalCount,
        freeHeaderHeight,
        wirelessPorts.length,
        layoutHints,
      )
  const headerHeight = layout.headerHeight
  const physicalGrid = usesPhysicalPortLayout(layout)
  const faceplate = usesEthernetFaceplateLayout(layout)
  const portGap = rackMounted
    ? (layout.portGap ?? 2)
    : faceplate
      ? (layout.portGap ?? PORT_GAP)
      : PORT_GAP
  const blockSize = layout.blockSize ?? ETHERNET_FACEPLATE_BLOCK_SIZE
  const blockGap = layout.blockGap ?? portGap
  const panelPad = rackMounted ? (layout.portPanelPad ?? 2) : PORT_PANEL_PADDING
  const panelHeaderH = rackMounted
    ? (layout.panelHeaderH ?? 0)
    : PORT_PANEL_HEADER_HEIGHT
  const wifiPanelHeaderH = rackMounted
    ? (layout.wifiPanelHeaderH ?? 0)
    : WIFI_PANEL_HEADER_HEIGHT
  const dotOverflow = rackMounted ? 0 : PORT_DOT_OVERFLOW
  const showPortCounterInHeader = rackMounted && panelHeaderH === 0 && totalPhysicalCount > 0

  const vlanCount = data.vlanCount ?? data.vlans?.length ?? 0
  const primaryNetwork = data.networks?.[0]
  const physicalInUse = physicalPorts.filter((p) => p.connected).length
  const wirelessInUse = wirelessPorts.filter((p) => p.connected).length
  const freePhysicalCount = Math.max(0, totalPhysicalCount - physicalInUse)
  const manufacturerModel = [data.manufacturer, data.model].filter(Boolean).join(' ')

  const baseWidth = layout.width
  const baseHeight = layout.height
  const scaleFromData = clampNodeScale(data.nodeScale ?? 1)
  const displayWidth =
    typeof width === 'number' && width > 0
      ? width
      : rackMounted
        ? baseWidth
        : Math.round(baseWidth * scaleFromData)
  const displayHeight =
    typeof height === 'number' && height > 0
      ? height
      : rackMounted
        ? baseHeight
        : Math.round(baseHeight * scaleFromData)
  const scaleX = displayWidth / baseWidth
  const scaleY = displayHeight / baseHeight

  /** Coordenadas de handles / anclas en el tamaño natural (dentro del transform). */
  const nodeWidth = baseWidth
  const nodeHeight = baseHeight

  const portLayoutKey = allPorts
    .map((p) => `${p.id}:${p.portNumber}:${p.portType}:${p.connected ? 1 : 0}`)
    .join('|')

  useLayoutEffect(() => {
    if (nodeId) updateNodeInternals(nodeId)
  }, [
    nodeId,
    updateNodeInternals,
    portLayoutKey,
    displayWidth,
    displayHeight,
    scaleX,
    scaleY,
    layout.cols,
    layout.rows,
    layout.gridTop,
    layout.wifiCols,
    layout.wifiRows,
    layout.wifiGridTop,
    headerHeight,
    rackMounted,
  ])

  const statusDot =
    data.status === 'online'
      ? 'bg-emerald-500'
      : data.status === 'offline'
        ? 'bg-red-500'
        : data.status === 'maintenance'
          ? 'bg-amber-500'
          : 'bg-gray-400'

  const onPortSelect = (portId: string) => {
    if (!selectPort) return
    const already = selection?.kind === 'port' && selection.portId === portId
    selectPort(already ? null : portId)
  }

  const renderHandles = (ports: TopologyPortSummary[], section: PortPanelSection) =>
    ports.map((port, index) => {
      const faces: Array<'front' | 'rear'> = port.isPassthrough
        ? ['rear', 'front']
        : [port.chassisFace === 'rear' ? 'rear' : 'front']
      const passthrough = !!port.isPassthrough
      return (
        <Fragment key={`handles-${port.id}`}>
          {faces.map((face) => {
            const srcTop = computePortSourceAnchor(
              port.portNumber,
              layout,
              nodeWidth,
              nodeHeight,
              index,
              'top',
              section,
              face,
              passthrough,
            )
            const srcBottom = computePortSourceAnchor(
              port.portNumber,
              layout,
              nodeWidth,
              nodeHeight,
              index,
              'bottom',
              section,
              face,
              passthrough,
            )
            const tgtTop = computePortTargetAnchor(
              port.portNumber,
              layout,
              nodeWidth,
              nodeHeight,
              index,
              'top',
              section,
              face,
              passthrough,
            )
            const tgtBottom = computePortTargetAnchor(
              port.portNumber,
              layout,
              nodeWidth,
              nodeHeight,
              index,
              'bottom',
              section,
              face,
              passthrough,
            )
            const connect = computePortConnectAnchor(
              port.portNumber,
              layout,
              nodeWidth,
              nodeHeight,
              index,
              section,
              face,
              passthrough,
            )
            const canConnect = portFaceConnectable(port, face, readOnly)
            const scale = portCellVisualScale(port.portType)
            const hitW = Math.max(6, Math.round(connect.cellW * scale))
            const hitH = Math.max(6, Math.round(connect.cellH * scale))
            return (
              <Fragment key={`handles-${port.id}-${face}`}>
                <Handle
                  id={portSourceHandleId(port.id, 'top', face)}
                  type="source"
                  position={Position.Top}
                  isConnectable={false}
                  className="!opacity-0 !size-1 !border-0 !bg-transparent !pointer-events-none"
                  style={{ position: 'absolute', left: srcTop.x, top: srcTop.y, transform: 'translate(-50%, -50%)' }}
                />
                <Handle
                  id={portSourceHandleId(port.id, 'bottom', face)}
                  type="source"
                  position={Position.Bottom}
                  isConnectable={false}
                  className="!opacity-0 !size-1 !border-0 !bg-transparent !pointer-events-none"
                  style={{
                    position: 'absolute',
                    left: srcBottom.x,
                    top: srcBottom.y,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                <Handle
                  id={portTargetHandleId(port.id, 'top', face)}
                  type="target"
                  position={Position.Top}
                  isConnectable={false}
                  className="!opacity-0 !size-1 !border-0 !bg-transparent !pointer-events-none"
                  style={{ position: 'absolute', left: tgtTop.x, top: tgtTop.y, transform: 'translate(-50%, -50%)' }}
                />
                <Handle
                  id={portTargetHandleId(port.id, 'bottom', face)}
                  type="target"
                  position={Position.Bottom}
                  isConnectable={false}
                  className="!opacity-0 !size-1 !border-0 !bg-transparent !pointer-events-none"
                  style={{
                    position: 'absolute',
                    left: tgtBottom.x,
                    top: tgtBottom.y,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
                {canConnect && (
                  <>
                    <Handle
                      id={portConnectTargetHandleId(port.id, face)}
                      type="target"
                      position={Position.Top}
                      isConnectable
                      className="!z-30 !rounded-sm !border-0 !bg-transparent"
                      style={{
                        position: 'absolute',
                        left: connect.x,
                        top: connect.y,
                        width: hitW,
                        height: hitH,
                        transform: 'translate(-50%, -50%)',
                        cursor: 'crosshair',
                      }}
                    />
                    <Handle
                      id={portConnectSourceHandleId(port.id, face)}
                      type="source"
                      position={Position.Bottom}
                      isConnectable
                      className="!z-30 !rounded-sm !border !border-emerald-400/0 !bg-emerald-400/0 hover:!border-emerald-400/60 hover:!bg-emerald-400/20"
                      style={{
                        position: 'absolute',
                        left: connect.x,
                        top: connect.y,
                        width: hitW,
                        height: hitH,
                        transform: 'translate(-50%, -50%)',
                        cursor: 'crosshair',
                      }}
                    />
                  </>
                )}
              </Fragment>
            )
          })}
        </Fragment>
      )
    })

  return (
    <div
      className={`relative box-border shrink-0 ${
        selected ? 'z-20' : ''
      }`}
      style={{
        width: displayWidth,
        height: displayHeight,
        overflow: rackMounted && !isShelfMounted ? 'hidden' : 'visible',
      }}
    >
      {!readOnly && !rackMounted && (
        <NodeResizer
          keepAspectRatio
          isVisible={!!selected}
          minWidth={Math.round(baseWidth * NODE_SCALE_MIN)}
          minHeight={Math.round(baseHeight * NODE_SCALE_MIN)}
          maxWidth={Math.round(baseWidth * NODE_SCALE_MAX)}
          maxHeight={Math.round(baseHeight * NODE_SCALE_MAX)}
          lineClassName="!border-amber-400/90 !border-[2px]"
          handleClassName="!h-3.5 !w-3.5 !rounded-sm !border-2 !border-amber-500 !bg-white dark:!bg-gray-900"
        />
      )}

      <div
        className={`relative box-border flex flex-col ${
          rackMounted
            ? isShelfMounted
              ? 'rounded-sm border-2 border-dashed border-violet-400 bg-violet-950/95 shadow-[0_4px_0_0_#b45309,0_6px_10px_-2px_rgba(0,0,0,0.55)]'
              : isRearMounted
                ? 'rounded-sm border border-amber-500/70 bg-slate-800 shadow-sm'
                : 'rounded-sm border border-slate-500/80 bg-slate-800 shadow-sm'
            : `rounded-lg border border-gray-300 dark:border-gray-600 shadow-md print:shadow-none ${
                hasPorts ? 'bg-transparent' : 'bg-white dark:bg-gray-800'
              }`
        } ${
          selected
            ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
            : ''
        }`}
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
        }}
      >
      {/* Marca de color del dispositivo */}
      <div
        className={`pointer-events-none absolute inset-y-px left-px z-10 print:shadow-none ${
          rackMounted ? 'w-1.5 rounded-l-[2px]' : 'w-2.5 rounded-l-[7px]'
        }`}
        style={{
          background: `linear-gradient(180deg, ${data.accentColor} 0%, ${data.accentColor}e6 50%, ${data.accentColor}b3 100%)`,
          boxShadow: rackMounted
            ? undefined
            : `0 0 12px 2px ${data.accentColor}73, 3px 0 8px ${data.accentColor}55`,
        }}
        aria-hidden
      />
      {!rackMounted && (
        <div
          className="pointer-events-none absolute inset-y-0 left-2.5 z-[1] w-4 rounded-l-sm print:hidden"
          style={{
            background: `linear-gradient(90deg, ${data.accentColor}33 0%, ${data.accentColor}14 45%, transparent 100%)`,
          }}
          aria-hidden
        />
      )}

      {!hasPorts && (
        <Handle type="target" position={Position.Top} className="!size-2.5 !border-gray-400 !bg-gray-200 dark:!bg-gray-600" />
      )}

      <div
        className={`relative z-[2] flex shrink-0 min-w-0 ${
          rackMounted
            ? isShelfMounted
              ? 'items-center gap-1 pl-2.5 pr-1.5 py-0.5 bg-violet-900/90'
              : 'items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 bg-slate-800'
            : 'items-start gap-2.5 pl-[1.125rem] pr-3.5 py-2.5 rounded-t-[7px] bg-white dark:bg-gray-800'
        }`}
        style={{ height: headerHeight, minHeight: headerHeight, maxHeight: headerHeight }}
      >
        <span
          className={`rounded-full shrink-0 ${rackMounted ? 'size-1.5' : 'size-2.5 mt-1.5'} ${statusDot}`}
          title={data.status}
        />
        {isShelfMounted ? (
          <span
            className="shrink-0 rounded px-1 py-px text-[7px] font-extrabold uppercase tracking-wider text-amber-50 bg-amber-600 ring-1 ring-amber-300/80"
            title="Apoyado en bandeja (no montado en riel)"
          >
            {baseWidth >= 160 ? 'Bandeja' : 'B'}
          </span>
        ) : isFullDepthMounted ? (
          <span
            className="shrink-0 rounded px-1 py-px text-[7px] font-extrabold uppercase tracking-wider text-violet-50 bg-violet-600 ring-1 ring-violet-300/80"
            title="Profundidad completa (frente + dorso)"
          >
            {baseWidth >= 160 ? 'Full' : 'F'}
          </span>
        ) : isRearMounted ? (
          <span
            className="shrink-0 rounded px-1 py-px text-[8px] font-bold uppercase tracking-wide text-amber-200 bg-amber-700/80"
            title="Montado en cara trasera"
          >
            R
          </span>
        ) : null}
        <div className={`min-w-0 flex-1 overflow-hidden ${rackMounted ? '' : 'space-y-0.5'}`}>
          {goDevice && nodeId ? (
            <button
              type="button"
              className={`nodrag nopan truncate text-left w-full focus:outline-none rounded ${
                rackMounted
                  ? 'text-[10px] font-bold leading-tight text-white hover:text-sky-300'
                  : 'text-base font-extrabold leading-tight tracking-tight text-gray-950 dark:text-white hover:text-blue-600 dark:hover:text-blue-300'
              }`}
              title={`Ver dispositivo: ${data.label}`}
              onClick={(e) => { e.stopPropagation(); goDevice(nodeId) }}
            >
              {data.label}
            </button>
          ) : (
            <p
              className={`truncate font-bold ${
                rackMounted
                  ? 'text-[10px] text-white'
                  : 'text-base font-extrabold leading-tight tracking-tight text-gray-950 dark:text-white'
              }`}
            >
              {data.label}
            </p>
          )}

          {rackMounted ? (
            headerHeight > 16 ? (
              <p className="truncate text-[8px] leading-none text-slate-400">
                {manufacturerModel || data.deviceType || `${data.rackUnits ?? 1}U`}
                {data.ipAddress ? ` · ${data.ipAddress}` : ''}
              </p>
            ) : null
          ) : (
            <>
              {data.deviceType && (
                <p className="text-[11px] font-semibold text-gray-600 dark:text-gray-300 truncate">{data.deviceType}</p>
              )}

              {data.hostname && (
                <p className="text-[11px] font-mono font-medium text-gray-700 dark:text-gray-200 truncate">{data.hostname}</p>
              )}

              {!isPatchPanel && (
                data.ipAddress ? (
                  <p className="text-xs font-mono font-semibold text-blue-700 dark:text-blue-300 truncate">{data.ipAddress}</p>
                ) : (
                  <p className="text-[10px] text-gray-400">Sin IP</p>
                )
              )}

              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                {!isPatchPanel && (
                  <span
                    className="inline-flex items-center rounded border border-violet-200 bg-violet-50 px-1.5 py-px text-[9px] font-semibold text-violet-700 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
                    title={formatVlanTooltip(data.vlans)}
                  >
                    {vlanCount === 0 ? 'Sin VLANs' : `${vlanCount} VLAN${vlanCount === 1 ? '' : 's'}`}
                  </span>
                )}
                {!isPatchPanel && primaryNetwork && (
                  <span className="inline-flex max-w-[8rem] truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-px text-[9px] text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                    {primaryNetwork.subnet}
                  </span>
                )}
                {totalPhysicalCount > 0 && (
                  <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-px text-[9px] text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                    {physicalInUse}/{totalPhysicalCount} puerto{totalPhysicalCount === 1 ? '' : 's'}
                  </span>
                )}
                {wirelessPorts.length > 0 && (
                  <span className="inline-flex items-center gap-0.5 rounded border border-sky-200 bg-sky-50 px-1.5 py-px text-[9px] font-semibold text-sky-700 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-300">
                    <Wifi className="size-2.5" aria-hidden strokeWidth={2.5} />
                    {wirelessPorts.length} SSID
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        {showPortCounterInHeader && (
          <span
            className="shrink-0 whitespace-nowrap text-[8px] font-semibold tabular-nums text-slate-400"
            title={`${physicalInUse} en uso de ${totalPhysicalCount}`}
          >
            <span className="text-emerald-400">{physicalInUse}</span>
            {`/${totalPhysicalCount}`}
          </span>
        )}
      </div>

      {hasPorts && (
        <div
          className={`relative box-border flex shrink-0 flex-col items-center ${
            rackMounted
              ? 'justify-center border-t border-slate-600/80'
              : 'border-t border-gray-200 dark:border-gray-700'
          }`}
          style={{
            width: nodeWidth,
            padding: panelPad,
            height: nodeHeight - headerHeight,
            minHeight: nodeHeight - headerHeight,
            maxHeight: nodeHeight - headerHeight,
          }}
        >
          <div
            className={
              rackMounted
                ? 'pointer-events-none absolute inset-0 bg-slate-950/50'
                : 'pointer-events-none absolute inset-x-0 top-0 rounded-b-[7px] bg-slate-50 dark:bg-gray-900/80'
            }
            style={rackMounted ? undefined : { bottom: dotOverflow }}
            aria-hidden
          />

          {hasPhysical && (
            <>
              {panelHeaderH > 0 && (
                <div
                  className="relative z-[1] mb-0.5 flex w-full shrink-0 items-center justify-between gap-1"
                  style={{ height: panelHeaderH, minHeight: panelHeaderH }}
                >
                  <span
                    className={`font-bold uppercase tracking-wider ${
                      rackMounted ? 'text-[7px] text-slate-400' : 'text-[8px] text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Puertos
                  </span>
                  {totalPhysicalCount > 0 && (
                    <span
                      className={`whitespace-nowrap ${
                        rackMounted ? 'text-[7px] text-slate-500' : 'text-[8px] text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      <span className="text-emerald-400">{physicalInUse}</span>
                      {`/${totalPhysicalCount}`}
                      {!rackMounted && freePhysicalCount > 0 && (
                        <>
                          {' · '}
                          <span>{freePhysicalCount} libre{freePhysicalCount === 1 ? '' : 's'}</span>
                        </>
                      )}
                    </span>
                  )}
                </div>
              )}

              {!rackMounted && layout.rows > 1 && physicalGrid && (
                <div
                  className="relative z-[1] mb-1 flex w-full shrink-0 items-center justify-center text-[9px] font-semibold text-gray-500 dark:text-gray-400"
                  style={{ height: PORT_ROW_LABEL_HEIGHT, minHeight: PORT_ROW_LABEL_HEIGHT }}
                >
                  <span>Pares verticales · 1↑ 2↓</span>
                </div>
              )}

              {!rackMounted && layout.rows > 1 && !physicalGrid && !faceplate && layout.cols === PATCH_PANEL_COLS && (
                <div className="relative z-[1] mb-1 flex w-full shrink-0 justify-between text-[8px] font-semibold text-gray-400 dark:text-gray-500">
                  <span>Fila sup.</span>
                  <span>Fila inf.</span>
                </div>
              )}

              {faceplate ? (
                <div
                  className="relative z-[1] shrink-0"
                  style={{ width: layout.gridWidth, height: layout.cellH }}
                >
                  {physicalPorts.map((port, index) => {
                    const { col } = portGridSlot(port.portNumber, layout.cols, index, false)
                    const left = faceplateColumnOffsetX(
                      col,
                      layout.cellW,
                      portGap,
                      blockGap,
                      blockSize,
                    )
                    return (
                      <div
                        key={port.id}
                        className="absolute top-0 flex items-center justify-center"
                        style={{ left, width: layout.cellW, height: layout.cellH }}
                      >
                        <PortCell
                          port={port}
                          cellW={layout.cellW}
                          cellH={layout.cellH}
                          compact={false}
                          rackMounted={rackMounted}
                          faceplate
                          selected={highlightedPortIds?.has(port.id) ?? false}
                          onSelect={onPortSelect}
                          connectable={portIsConnectable(port, readOnly)}
                        />
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div
                  className="relative z-[1] grid shrink-0"
                  style={{
                    width: layout.gridWidth,
                    gridTemplateColumns: `repeat(${layout.cols}, ${layout.cellW}px)`,
                    gridTemplateRows:
                      layout.rows > 1 ? `repeat(${layout.rows}, ${layout.cellH}px)` : undefined,
                    gap: portGap,
                  }}
                >
                  {physicalPorts.map((port, index) => {
                    const { row, col } = portGridSlot(
                      port.portNumber,
                      layout.cols,
                      index,
                      physicalGrid,
                    )
                    return (
                      <div
                        key={port.id}
                        className="flex items-center justify-center"
                        style={{ gridColumn: col + 1, gridRow: row + 1 }}
                      >
                        <PortCell
                          port={port}
                          cellW={layout.cellW}
                          cellH={layout.cellH}
                          compact={layout.compact && !rackMounted}
                          rackMounted={rackMounted}
                          selected={highlightedPortIds?.has(port.id) ?? false}
                          onSelect={onPortSelect}
                          connectable={portIsConnectable(port, readOnly)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          {hasPhysical && hasWireless && (
            <div
              className="relative z-[1] w-full shrink-0"
              style={{ height: rackMounted ? 2 : WIFI_SECTION_GAP }}
              aria-hidden
            />
          )}

          {hasWireless && (
            <>
              {wifiPanelHeaderH > 0 && (
                <div
                  className="relative z-[1] mb-0.5 flex w-full shrink-0 items-center justify-between gap-1"
                  style={{
                    height: wifiPanelHeaderH,
                    minHeight: wifiPanelHeaderH,
                  }}
                >
                  <span
                    className={`inline-flex items-center gap-0.5 font-bold uppercase tracking-wider text-sky-400 ${
                      rackMounted ? 'text-[7px]' : 'text-[8px]'
                    }`}
                  >
                    <Wifi className="size-2.5" aria-hidden strokeWidth={2.5} />
                    WiFi
                  </span>
                  <span
                    className={`whitespace-nowrap ${
                      rackMounted ? 'text-[7px] text-slate-500' : 'text-[8px] text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {wirelessInUse}/{wirelessPorts.length}
                  </span>
                </div>
              )}

              <div
                className="relative z-[1] grid shrink-0"
                style={{
                  width: layout.wifiGridWidth,
                  gridTemplateColumns: `repeat(${layout.wifiCols}, ${layout.wifiCellW}px)`,
                  gridTemplateRows:
                    layout.wifiRows > 1 ? `repeat(${layout.wifiRows}, ${layout.wifiCellH}px)` : undefined,
                  gap: rackMounted ? portGap : WIFI_GAP,
                }}
              >
                {wirelessPorts.map((port, index) => {
                  const { row, col } = portGridSlot(port.portNumber, layout.wifiCols, index, false)
                  return (
                    <div key={port.id} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
                      <WifiChip
                        port={port}
                        cellW={layout.wifiCellW}
                        cellH={layout.wifiCellH}
                        selected={highlightedPortIds?.has(port.id) ?? false}
                        onSelect={onPortSelect}
                        connectable={portIsConnectable(port, readOnly)}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {renderHandles(physicalPorts, 'physical')}
      {renderHandles(wirelessPorts, 'wireless')}

      {!hasPorts && (
        <Handle type="source" position={Position.Bottom} className="!size-2.5 !border-gray-400 !bg-gray-200 dark:!bg-gray-600" />
      )}
      </div>
    </div>
  )
}
