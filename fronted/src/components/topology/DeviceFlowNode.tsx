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
  computePortPanelLayout,
  computePortSourceAnchor,
  computePortTargetAnchor,
  isCompactPortPanel,
  isStructuredCablingDeviceType,
  partitionDiagramPorts,
  portCellClasses,
  portGridSlot,
  portSourceHandleId,
  portTargetHandleId,
  sortTopologyPorts,
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

function PortCell({
  port,
  cellW,
  cellH,
  compact,
  selected,
  onSelect,
}: {
  port: TopologyPortSummary
  cellW: number
  cellH: number
  compact: boolean
  selected: boolean
  onSelect: (portId: string) => void
}) {
  const displayName = port.name?.trim() || String(port.portNumber)

  return (
    <button
      type="button"
      className={`nodrag nopan relative box-border flex flex-col items-center justify-center rounded border leading-none transition ${portCellClasses(port)} ${
        compact ? 'gap-0.5 px-1 py-1' : 'px-0.5'
      } ${selected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900 z-20' : ''} ${
        port.connected ? 'cursor-pointer hover:brightness-110' : 'cursor-default'
      }`}
      style={{ width: cellW, height: cellH, minWidth: cellW, maxWidth: cellW, minHeight: cellH, maxHeight: cellH }}
      title={
        port.connected
          ? `Puerto ${port.portNumber} · ${displayName} · clic para ir al dispositivo conectado`
          : `Puerto ${port.portNumber} · ${displayName}`
      }
      onClick={(e) => {
        e.stopPropagation()
        if (port.connected) onSelect(port.id)
      }}
    >
      {compact ? (
        <>
          <span className="max-w-full truncate text-center text-[11px] font-bold leading-none tracking-tight">
            {displayName}
          </span>
          <span className="text-[8px] font-medium tabular-nums opacity-70 leading-none">
            #{port.portNumber}
          </span>
        </>
      ) : (
        <span className="max-w-full truncate text-center text-[8px] font-bold leading-none tracking-tight">
          {displayName}
        </span>
      )}
      {port.connected && (
        <span
          className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 size-1.5 rounded-full bg-blue-600 ring-1 ring-white dark:ring-gray-900"
          aria-hidden
        />
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
}: {
  port: TopologyPortSummary
  cellW: number
  cellH: number
  selected: boolean
  onSelect: (portId: string) => void
}) {
  const displayName = port.name?.trim() || `SSID #${port.portNumber}`

  return (
    <button
      type="button"
      className={`nodrag nopan relative box-border flex items-center gap-1.5 rounded-full border px-2.5 leading-none transition ${wifiChipClasses(port)} ${
        selected ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900 z-20' : ''
      } ${port.connected ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}`}
      style={{ width: cellW, height: cellH, minWidth: cellW, maxWidth: cellW, minHeight: cellH, maxHeight: cellH }}
      title={
        port.connected
          ? `WiFi · ${displayName} · clic para ir al dispositivo conectado`
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

  const isPatchPanel = isStructuredCablingDeviceType(data.deviceType)
  const headerHeight = isPatchPanel ? TOPOLOGY_HEADER_HEIGHT_PATCH : TOPOLOGY_HEADER_HEIGHT

  const allPorts = sortTopologyPorts(data.ports ?? [])
  const { physical: physicalPorts, wireless: wirelessPorts } = partitionDiagramPorts(allPorts)
  const totalPhysicalCount =
    data.totalPortCount != null
      ? Math.max(0, data.totalPortCount - wirelessPorts.length)
      : physicalPorts.length
  const compact = isCompactPortPanel(physicalPorts.length, totalPhysicalCount)
  const hasPhysical = physicalPorts.length > 0
  const hasWireless = wirelessPorts.length > 0
  const hasPorts = hasPhysical || hasWireless

  const layout = computePortPanelLayout(
    physicalPorts.length,
    compact,
    totalPhysicalCount,
    headerHeight,
    wirelessPorts.length,
  )
  const physicalGrid = usesPhysicalPortLayout(layout)

  const vlanCount = data.vlanCount ?? data.vlans?.length ?? 0
  const primaryNetwork = data.networks?.[0]
  const physicalInUse = physicalPorts.filter((p) => p.connected).length
  const wirelessInUse = wirelessPorts.filter((p) => p.connected).length
  const freePhysicalCount = Math.max(0, totalPhysicalCount - physicalInUse)

  const baseWidth = layout.width
  const baseHeight = layout.height
  const scaleFromData = clampNodeScale(data.nodeScale ?? 1)
  const displayWidth =
    typeof width === 'number' && width > 0 ? width : Math.round(baseWidth * scaleFromData)
  const displayHeight =
    typeof height === 'number' && height > 0 ? height : Math.round(baseHeight * scaleFromData)
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
      const srcTop = computePortSourceAnchor(
        port.portNumber,
        layout,
        nodeWidth,
        nodeHeight,
        index,
        'top',
        section,
      )
      const srcBottom = computePortSourceAnchor(
        port.portNumber,
        layout,
        nodeWidth,
        nodeHeight,
        index,
        'bottom',
        section,
      )
      const tgtTop = computePortTargetAnchor(
        port.portNumber,
        layout,
        nodeWidth,
        nodeHeight,
        index,
        'top',
        section,
      )
      const tgtBottom = computePortTargetAnchor(
        port.portNumber,
        layout,
        nodeWidth,
        nodeHeight,
        index,
        'bottom',
        section,
      )
      return (
        <Fragment key={`handles-${port.id}`}>
          <Handle
            id={portSourceHandleId(port.id, 'top')}
            type="source"
            position={Position.Top}
            className="!opacity-0 !size-1 !border-0 !bg-transparent"
            style={{ position: 'absolute', left: srcTop.x, top: srcTop.y, transform: 'translate(-50%, -50%)' }}
          />
          <Handle
            id={portSourceHandleId(port.id, 'bottom')}
            type="source"
            position={Position.Bottom}
            className="!opacity-0 !size-1 !border-0 !bg-transparent"
            style={{ position: 'absolute', left: srcBottom.x, top: srcBottom.y, transform: 'translate(-50%, -50%)' }}
          />
          <Handle
            id={portTargetHandleId(port.id, 'top')}
            type="target"
            position={Position.Top}
            className="!opacity-0 !size-1 !border-0 !bg-transparent"
            style={{ position: 'absolute', left: tgtTop.x, top: tgtTop.y, transform: 'translate(-50%, -50%)' }}
          />
          <Handle
            id={portTargetHandleId(port.id, 'bottom')}
            type="target"
            position={Position.Bottom}
            className="!opacity-0 !size-1 !border-0 !bg-transparent"
            style={{ position: 'absolute', left: tgtBottom.x, top: tgtBottom.y, transform: 'translate(-50%, -50%)' }}
          />
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
        overflow: 'visible',
      }}
    >
      {!readOnly && (
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
        className={`relative box-border flex flex-col rounded-lg border border-gray-300 dark:border-gray-600 shadow-md print:shadow-none ${
          hasPorts ? 'bg-transparent' : 'bg-white dark:bg-gray-800'
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
          overflow: 'visible',
        }}
      >
      {/* Marca de color del dispositivo */}
      <div
        className="pointer-events-none absolute inset-y-px left-px z-10 w-2.5 rounded-l-[7px] print:shadow-none"
        style={{
          background: `linear-gradient(180deg, ${data.accentColor} 0%, ${data.accentColor}e6 50%, ${data.accentColor}b3 100%)`,
          boxShadow: `0 0 12px 2px ${data.accentColor}73, 3px 0 8px ${data.accentColor}55`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-0 left-2.5 z-[1] w-4 rounded-l-sm print:hidden"
        style={{
          background: `linear-gradient(90deg, ${data.accentColor}33 0%, ${data.accentColor}14 45%, transparent 100%)`,
        }}
        aria-hidden
      />

      {!hasPorts && (
        <Handle type="target" position={Position.Top} className="!size-2.5 !border-gray-400 !bg-gray-200 dark:!bg-gray-600" />
      )}

      <div
        className="relative z-[2] flex shrink-0 items-start gap-2.5 min-w-0 pl-[1.125rem] pr-3.5 py-2.5 rounded-t-[7px] bg-white dark:bg-gray-800"
        style={{ height: headerHeight, minHeight: headerHeight, maxHeight: headerHeight }}
      >
        <span className={`size-2.5 rounded-full shrink-0 mt-1.5 ${statusDot}`} title={data.status} />
        <div className="min-w-0 flex-1 space-y-0.5 overflow-hidden">
          {goDevice && nodeId ? (
            <button
              type="button"
              className="nodrag nopan text-base font-extrabold leading-tight tracking-tight text-gray-950 dark:text-white truncate text-left w-full hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none rounded"
              title={`Ver dispositivo: ${data.label}`}
              onClick={(e) => { e.stopPropagation(); goDevice(nodeId) }}
            >
              {data.label}
            </button>
          ) : (
            <p className="text-base font-extrabold leading-tight tracking-tight text-gray-950 dark:text-white truncate">
              {data.label}
            </p>
          )}

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
        </div>
      </div>

      {hasPorts && (
        <div
          className="relative box-border flex shrink-0 flex-col items-center border-t border-gray-200 dark:border-gray-700"
          style={{
            width: nodeWidth,
            padding: PORT_PANEL_PADDING,
            height: nodeHeight - headerHeight,
            minHeight: nodeHeight - headerHeight,
            maxHeight: nodeHeight - headerHeight,
          }}
        >
          {/* Fondo solo detrás de la grilla; la zona inferior queda transparente para ver los cables. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 rounded-b-[7px] bg-slate-50 dark:bg-gray-900/80"
            style={{ bottom: PORT_DOT_OVERFLOW }}
            aria-hidden
          />

          {hasPhysical && (
            <>
              <div
                className="relative z-[1] mb-1 flex w-full shrink-0 items-center justify-between gap-2"
                style={{ height: PORT_PANEL_HEADER_HEIGHT, minHeight: PORT_PANEL_HEADER_HEIGHT }}
              >
                <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Puertos
                </span>
                {totalPhysicalCount > 0 && (
                  <span className="text-[8px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    <span className="text-emerald-600 dark:text-emerald-400">{physicalInUse} en uso</span>
                    {freePhysicalCount > 0 && (
                      <>
                        {' · '}
                        <span>{freePhysicalCount} libre{freePhysicalCount === 1 ? '' : 's'}</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              {layout.rows > 1 && physicalGrid && (
                <div
                  className="relative z-[1] mb-1 flex w-full shrink-0 items-center justify-between text-[9px] font-semibold text-gray-500 dark:text-gray-400"
                  style={{ height: PORT_ROW_LABEL_HEIGHT, minHeight: PORT_ROW_LABEL_HEIGHT }}
                >
                  <span>1 – 12</span>
                  <span>13 – 24</span>
                </div>
              )}

              {layout.rows > 1 && !physicalGrid && layout.cols === PATCH_PANEL_COLS && (
                <div className="relative z-[1] mb-1 flex w-full shrink-0 justify-between text-[8px] font-semibold text-gray-400 dark:text-gray-500">
                  <span>Fila sup.</span>
                  <span>Fila inf.</span>
                </div>
              )}

              <div
                className="relative z-[1] grid shrink-0"
                style={{
                  width: layout.gridWidth,
                  gridTemplateColumns: `repeat(${layout.cols}, ${layout.cellW}px)`,
                  gridTemplateRows: layout.rows > 1 ? `repeat(${layout.rows}, ${layout.cellH}px)` : undefined,
                  gap: PORT_GAP,
                }}
              >
                {physicalPorts.map((port, index) => {
                  const { row, col } = portGridSlot(port.portNumber, layout.cols, index, physicalGrid)
                  return (
                    <div key={port.id} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
                      <PortCell
                        port={port}
                        cellW={layout.cellW}
                        cellH={layout.cellH}
                        compact={layout.compact}
                        selected={highlightedPortIds?.has(port.id) ?? false}
                        onSelect={onPortSelect}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {hasPhysical && hasWireless && (
            <div className="relative z-[1] w-full shrink-0" style={{ height: WIFI_SECTION_GAP }} aria-hidden />
          )}

          {hasWireless && (
            <>
              <div
                className="relative z-[1] mb-1 flex w-full shrink-0 items-center justify-between gap-2"
                style={{ height: WIFI_PANEL_HEADER_HEIGHT, minHeight: WIFI_PANEL_HEADER_HEIGHT }}
              >
                <span className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                  <Wifi className="size-2.5" aria-hidden strokeWidth={2.5} />
                  WiFi
                </span>
                <span className="text-[8px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  <span className="text-sky-600 dark:text-sky-400">{wirelessInUse} en uso</span>
                  {' · '}
                  <span>
                    {wirelessPorts.length} SSID{wirelessPorts.length === 1 ? '' : 's'}
                  </span>
                </span>
              </div>

              <div
                className="relative z-[1] grid shrink-0"
                style={{
                  width: layout.wifiGridWidth,
                  gridTemplateColumns: `repeat(${layout.wifiCols}, ${layout.wifiCellW}px)`,
                  gridTemplateRows:
                    layout.wifiRows > 1 ? `repeat(${layout.wifiRows}, ${layout.wifiCellH}px)` : undefined,
                  gap: WIFI_GAP,
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
