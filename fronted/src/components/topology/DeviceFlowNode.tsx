import { Handle, Position, useNodeId, useUpdateNodeInternals, type Node, type NodeProps } from '@xyflow/react'
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
  computePortPanelLayout,
  computePortSourceAnchor,
  computePortTargetAnchor,
  getDiagramDisplayPorts,
  isCompactPortPanel,
  isStructuredCablingDeviceType,
  portCellClasses,
  portGridSlot,
  portSourceHandleId,
  portTargetHandleId,
  sortTopologyPorts,
  usesPhysicalPortLayout,
} from '../../utils/topologyPortPanel'

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
          ? `Puerto ${port.portNumber} · ${displayName} · clic para resaltar enlace`
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

export function DeviceFlowNode({ data }: NodeProps<DeviceFlowNodeType>) {
  const nodeId = useNodeId()
  const updateNodeInternals = useUpdateNodeInternals()
  const interaction = useContext(TopologyCanvasInteractionContext)
  const goDevice = interaction?.onNavigateToDevice
  const selection = interaction?.selection ?? null
  const highlightedPortIds = interaction?.highlightedPortIds
  const selectPort = interaction?.selectPort

  const isPatchPanel = isStructuredCablingDeviceType(data.deviceType)
  const headerHeight = isPatchPanel ? TOPOLOGY_HEADER_HEIGHT_PATCH : TOPOLOGY_HEADER_HEIGHT

  const allPorts = sortTopologyPorts(data.ports ?? [])
  const displayPorts = getDiagramDisplayPorts(allPorts)
  const totalPortCount = data.totalPortCount ?? data.portCount ?? allPorts.length
  const compact = isCompactPortPanel(displayPorts.length, totalPortCount)
  const hasPorts = displayPorts.length > 0

  const layout = computePortPanelLayout(displayPorts.length, compact, totalPortCount, headerHeight)
  const physicalGrid = usesPhysicalPortLayout(layout)

  const vlanCount = data.vlanCount ?? data.vlans?.length ?? 0
  const primaryNetwork = data.networks?.[0]
  const portsInUse = data.portsInUse ?? allPorts.filter((p) => p.connected).length
  const freePortCount = Math.max(0, totalPortCount - portsInUse)

  const nodeWidth = layout.width
  const nodeHeight = layout.height

  const portLayoutKey = displayPorts
    .map((p) => `${p.id}:${p.portNumber}:${p.connected ? 1 : 0}`)
    .join('|')

  useLayoutEffect(() => {
    if (nodeId) updateNodeInternals(nodeId)
  }, [nodeId, updateNodeInternals, portLayoutKey, nodeWidth, nodeHeight, layout.cols, layout.rows, layout.gridTop, headerHeight])

  const statusDot =
    data.status === 'online'
      ? 'bg-emerald-500'
      : data.status === 'offline'
        ? 'bg-red-500'
        : data.status === 'maintenance'
          ? 'bg-amber-500'
          : 'bg-gray-400'

  return (
    <div
      className={`relative box-border flex flex-col rounded-lg border border-gray-300 dark:border-gray-600 shadow-md shrink-0 print:shadow-none ${
        hasPorts ? 'bg-transparent' : 'bg-white dark:bg-gray-800'
      }`}
      style={{
        width: nodeWidth,
        height: nodeHeight,
        minWidth: nodeWidth,
        maxWidth: nodeWidth,
        minHeight: nodeHeight,
        maxHeight: nodeHeight,
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
            {totalPortCount > 0 && (
              <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-px text-[9px] text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300">
                {portsInUse}/{totalPortCount} puertos
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
          {/* Fondo solo detrás de la grilla de puertos; la zona inferior queda transparente para ver los cables. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-0 rounded-b-[7px] bg-slate-50 dark:bg-gray-900/80"
            style={{ bottom: PORT_DOT_OVERFLOW }}
            aria-hidden
          />
          <div
            className="relative z-[1] mb-1 flex w-full shrink-0 items-center justify-between gap-2"
            style={{ height: PORT_PANEL_HEADER_HEIGHT, minHeight: PORT_PANEL_HEADER_HEIGHT }}
          >
            <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Puertos
            </span>
            {totalPortCount > 0 && (
              <span className="text-[8px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                <span className="text-emerald-600 dark:text-emerald-400">{portsInUse} en uso</span>
                {freePortCount > 0 && (
                  <>
                    {' · '}
                    <span>{freePortCount} libre{freePortCount === 1 ? '' : 's'}</span>
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
            {displayPorts.map((port, index) => {
              const { row, col } = portGridSlot(port.portNumber, layout.cols, index, physicalGrid)
              return (
                <div key={port.id} style={{ gridColumn: col + 1, gridRow: row + 1 }}>
                  <PortCell
                    port={port}
                    cellW={layout.cellW}
                    cellH={layout.cellH}
                    compact={layout.compact}
                    selected={highlightedPortIds?.has(port.id) ?? false}
                    onSelect={(portId) => {
                      if (!selectPort) return
                      const already = selection?.kind === 'port' && selection.portId === portId
                      selectPort(already ? null : portId)
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {displayPorts.map((port, index) => {
        const srcTop = computePortSourceAnchor(port.portNumber, layout, nodeWidth, nodeHeight, index, 'top')
        const srcBottom = computePortSourceAnchor(port.portNumber, layout, nodeWidth, nodeHeight, index, 'bottom')
        const tgtTop = computePortTargetAnchor(port.portNumber, layout, nodeWidth, nodeHeight, index, 'top')
        const tgtBottom = computePortTargetAnchor(port.portNumber, layout, nodeWidth, nodeHeight, index, 'bottom')
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
      })}

      {!hasPorts && (
        <Handle type="source" position={Position.Bottom} className="!size-2.5 !border-gray-400 !bg-gray-200 dark:!bg-gray-600" />
      )}
    </div>
  )
}
