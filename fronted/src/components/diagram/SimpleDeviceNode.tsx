import { memo } from 'react'
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { X } from 'lucide-react'
import {
  DIAGRAM_CONNECT_SOURCE_HANDLE,
  DIAGRAM_CONNECT_TARGET_HANDLE,
  diagramHandleCenterY,
  type DiagramPortHandle,
} from '../../utils/diagram/diagramPortHandles'

export const SIMPLE_DEVICE_WIDTH = 360
export const SIMPLE_DEVICE_BASE_H = 36
export const SIMPLE_DEVICE_PORT_ROW_H = 18
export const SIMPLE_DEVICE_NAME_LINE_H = 18
export const SIMPLE_DEVICE_NAME_ROW_H = 24
export const SIMPLE_DEVICE_META_H = 14
export const SIMPLE_DEVICE_GAP = 8
export const CONTAINER_PAD = 12
/** Title + ubicación (hasta 2 líneas). */
export const CONTAINER_HEADER_H = 60
export const CONTAINER_SELECTOR_H = 40

export type SimpleDevicePortClick = {
  handleId: string
  label: string
  side: 'source' | 'target'
}

export type SimpleDeviceNodeData = {
  label: string
  deviceType: string | null
  ipAddress: string | null
  status: string
  accentColor: string
  /** Puertos con al menos un diagram_link en este canvas. */
  portsInUse?: number
  /** Total de puertos del equipo (inventario). */
  portCount?: number
  readOnly?: boolean
  /** Puertos con enlace saliente en este diagrama (solo los conectados). */
  sourcePorts?: DiagramPortHandle[]
  /** Puertos con enlace entrante en este diagrama (solo los conectados). */
  targetPorts?: DiagramPortHandle[]
  onRemove?: () => void
  /** Click en un puerto conectado → crear nuevo enlace con ese origen. */
  onPortClick?: (params: SimpleDevicePortClick) => void
  /** Doble clic en el equipo → abrir modal de nuevo enlace. */
  onDeviceDoubleClick?: () => void
  [key: string]: unknown
}

export type SimpleDeviceNodeType = Node<SimpleDeviceNodeData, 'simpleDevice'>

/** Lines needed to show the full device name (no ellipsis). */
export function estimateDeviceNameLines(label: string): number {
  const chrome = 16 + 22 // horizontal padding + remove button
  const usable = Math.max(80, SIMPLE_DEVICE_WIDTH - chrome)
  // ~7.4px per glyph at text-sm semibold for inventory-style codes
  const charsPerLine = Math.max(10, Math.floor(usable / 7.4))
  return Math.min(5, Math.max(1, Math.ceil((label || ' ').length / charsPerLine)))
}

/**
 * Device height grows with wrapped name + denser side of connected ports
 * (unconnected ports are never shown).
 */
export function simpleDeviceHeight(connectedPortSlots = 0, label = ''): number {
  const slots = Math.max(0, connectedPortSlots)
  const nameLines = estimateDeviceNameLines(label)
  const nameBlock = nameLines * SIMPLE_DEVICE_NAME_LINE_H + 4
  // Reserve meta row for "n / m puertos" (common for inventory devices).
  const header = nameBlock + SIMPLE_DEVICE_META_H
  if (slots <= 0) return Math.max(SIMPLE_DEVICE_BASE_H, header + 8)
  return Math.max(SIMPLE_DEVICE_BASE_H, header + slots * SIMPLE_DEVICE_PORT_ROW_H + 6)
}

function SimpleDeviceNodeComponent({ data, selected }: NodeProps<SimpleDeviceNodeType>) {
  const canReorder = !data.readOnly
  const sourcePorts = data.sourcePorts ?? []
  const targetPorts = data.targetPorts ?? []
  const showPortRows = sourcePorts.length > 0 || targetPorts.length > 0
  const displayHeight = simpleDeviceHeight(
    Math.max(sourcePorts.length, targetPorts.length),
    data.label
  )
  const canConnect = !data.readOnly
  const canClickPorts = !data.readOnly && Boolean(data.onPortClick)
  const canDoubleClickLink = !data.readOnly && Boolean(data.onDeviceDoubleClick)
  const portCount = data.portCount ?? 0
  const portsInUse = data.portsInUse ?? 0
  const showPortCounter = portCount > 0
  const nameLines = estimateDeviceNameLines(data.label)
  const nameBlockH = nameLines * SIMPLE_DEVICE_NAME_LINE_H + 4
  const headerH = nameBlockH + (showPortCounter ? SIMPLE_DEVICE_META_H : 0)
  const portAreaTop = showPortRows ? headerH : 0
  const portAreaH = Math.max(1, displayHeight - portAreaTop)

  const emitPortClick = (port: DiagramPortHandle, side: 'source' | 'target') => {
    if (!canClickPorts) return
    data.onPortClick?.({ handleId: port.id, label: port.label, side })
  }

  return (
    <div
      className={`relative rounded-md border bg-white shadow-sm dark:bg-slate-900 ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-400/40'
          : 'border-slate-300 dark:border-slate-600'
      } ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
        width: SIMPLE_DEVICE_WIDTH,
        height: displayHeight,
        borderLeftWidth: 4,
        borderLeftColor: data.accentColor,
      }}
      title={
        canDoubleClickLink
          ? 'Doble clic para crear enlace'
          : canReorder
            ? 'Arrastrá para reordenar'
            : undefined
      }
      onDoubleClick={
        canDoubleClickLink
          ? (e) => {
              e.stopPropagation()
              data.onDeviceDoubleClick?.()
            }
          : undefined
      }
    >
      {/* Anclajes visibles: solo puertos que ya tienen diagram_link. */}
      {targetPorts.map((port, index) => (
        <Handle
          key={port.id}
          type="target"
          position={Position.Left}
          id={port.id}
          className="!h-2.5 !w-2.5 !border-0 !bg-blue-500 nodrag nopan"
          style={{
            left: -5,
            top: portAreaTop + diagramHandleCenterY(index, targetPorts.length, portAreaH),
          }}
          isConnectable={false}
          title={port.label}
        />
      ))}
      {sourcePorts.map((port, index) => (
        <Handle
          key={port.id}
          type="source"
          position={Position.Right}
          id={port.id}
          className="!h-2.5 !w-2.5 !border-0 !bg-blue-500 nodrag nopan"
          style={{
            right: -5,
            top: portAreaTop + diagramHandleCenterY(index, sourcePorts.length, portAreaH),
          }}
          isConnectable={false}
          title={port.label}
        />
      ))}

      {/*
        Handle genérico para crear enlaces (no es un puerto del inventario).
        Visible si el lado no tiene puertos conectados; si ya tiene, queda
        invisible pero permite arrastrar un enlace adicional.
      */}
      {canConnect ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id={DIAGRAM_CONNECT_TARGET_HANDLE}
            className={`!border-0 nodrag nopan ${
              targetPorts.length > 0
                ? '!h-full !w-3 !opacity-0'
                : '!h-2.5 !w-2.5 !bg-blue-500'
            }`}
            style={
              targetPorts.length > 0
                ? { left: -6, top: 0, transform: 'none', height: '100%' }
                : { left: -5, top: '50%' }
            }
            isConnectable
          />
          <Handle
            type="source"
            position={Position.Right}
            id={DIAGRAM_CONNECT_SOURCE_HANDLE}
            className={`!border-0 nodrag nopan ${
              sourcePorts.length > 0
                ? '!h-full !w-3 !opacity-0'
                : '!h-2.5 !w-2.5 !bg-blue-500'
            }`}
            style={
              sourcePorts.length > 0
                ? { right: -6, top: 0, transform: 'none', height: '100%' }
                : { right: -5, top: '50%' }
            }
            isConnectable
          />
        </>
      ) : null}

      <div className="flex h-full flex-col px-2 py-1">
        <div className="flex items-start gap-1" style={{ minHeight: nameBlockH }}>
          <div
            className="min-w-0 flex-1 break-all text-sm font-semibold leading-[18px] text-slate-900 dark:text-slate-100"
            title={data.label}
          >
            {data.label}
          </div>
          {!data.readOnly && data.onRemove ? (
            <button
              type="button"
              title="Sacar del diagrama"
              className="nodrag nopan shrink-0 rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400"
              onClick={(e) => {
                e.stopPropagation()
                data.onRemove?.()
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        {showPortCounter ? (
          <div
            className="flex items-center"
            style={{ height: SIMPLE_DEVICE_META_H }}
          >
            <span
              className="whitespace-nowrap text-[9px] tabular-nums text-slate-500 dark:text-slate-400"
              title={`${portsInUse} de ${portCount} puertos con enlace en este diagrama`}
            >
              {portsInUse} / {portCount} puertos
            </span>
          </div>
        ) : null}

        {showPortRows ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-0.5">
            {Array.from({
              length: Math.max(sourcePorts.length, targetPorts.length),
            }).map((_, index) => {
              const target = targetPorts[index]
              const source = sourcePorts[index]
              return (
                <div
                  key={`port-row-${index}`}
                  className="flex items-center justify-between gap-2"
                  style={{ minHeight: SIMPLE_DEVICE_PORT_ROW_H - 2 }}
                >
                  {target ? (
                    <button
                      type="button"
                      className={`nodrag nopan max-w-[45%] truncate rounded px-1 text-left text-[10px] font-medium leading-tight ${
                        canClickPorts
                          ? 'cursor-pointer text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                      title={
                        canClickPorts
                          ? `Nuevo enlace desde ${target.label}`
                          : target.label
                      }
                      disabled={!canClickPorts}
                      onClick={(e) => {
                        e.stopPropagation()
                        emitPortClick(target, 'target')
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {target.label}
                    </button>
                  ) : (
                    <span className="max-w-[45%]" />
                  )}
                  {source ? (
                    <button
                      type="button"
                      className={`nodrag nopan max-w-[45%] truncate rounded px-1 text-right text-[10px] font-medium leading-tight ${
                        canClickPorts
                          ? 'cursor-pointer text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                      title={
                        canClickPorts
                          ? `Nuevo enlace desde ${source.label}`
                          : source.label
                      }
                      disabled={!canClickPorts}
                      onClick={(e) => {
                        e.stopPropagation()
                        emitPortClick(source, 'source')
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      {source.label}
                    </button>
                  ) : (
                    <span className="max-w-[45%]" />
                  )}
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const SimpleDeviceNode = memo(SimpleDeviceNodeComponent)
