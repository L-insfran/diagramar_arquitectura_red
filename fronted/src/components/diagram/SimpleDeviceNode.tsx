import { memo, useCallback, useEffect, useRef, useState } from 'react'
import {
  Handle,
  NodeResizer,
  Position,
  useStore,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { MoreVertical } from 'lucide-react'
import {
  DIAGRAM_CONNECT_SOURCE_HANDLE,
  DIAGRAM_CONNECT_TARGET_HANDLE,
} from '../../utils/diagram/diagramPortHandles'
import type { DiagramPortSlot } from '../../utils/diagram/devicePortSlots'
import {
  anchorToHandleStyle,
  anchorToLabelStyle,
  projectPointerToPerimeter,
  type DiagramHandleAnchor,
} from '../../utils/diagram/handleAnchor'
import {
  DIAGRAM_DEVICE_CHAR_PX,
  DIAGRAM_DEVICE_META,
  DIAGRAM_DEVICE_NAME,
} from '../../utils/diagram/diagramTypography'
export const SIMPLE_DEVICE_WIDTH = 360
export const SIMPLE_DEVICE_MIN_WIDTH = 180
export const SIMPLE_DEVICE_BASE_H = 40
export const SIMPLE_DEVICE_PORT_ROW_H = 22
export const SIMPLE_DEVICE_PORT_ROW_COMPACT_H = 16
export const SIMPLE_DEVICE_NAME_LINE_H = 22
export const SIMPLE_DEVICE_NAME_ROW_H = 28
export const SIMPLE_DEVICE_META_H = 16
export const SIMPLE_DEVICE_GAP = 28
export const DEVICE_GAP_MIN = 8
export const DEVICE_GAP_MAX = 72
export const DEVICE_GAP_STEP = 4
export const SIMPLE_DEVICE_STACK_PAD = 18
/** Matches Tailwind `border` on the device card. */
export const DEVICE_NODE_BORDER = 1
/** Accent strip (`borderLeftWidth`) on the device card. */
export const DEVICE_NODE_ACCENT_BORDER = 4
/**
 * Border-box → padding-box inset for absolute handles/labels.
 * Only left/top are needed: padding origin is after those borders;
 * right/bottom borders do not change that conversion.
 */
export const DEVICE_NODE_INSET = {
  left: DEVICE_NODE_ACCENT_BORDER,
  top: DEVICE_NODE_BORDER,
  right: DEVICE_NODE_BORDER,
  bottom: DEVICE_NODE_BORDER,
}

export type DeviceStackLayoutOpts = {
  hidePicker?: boolean
  deviceGap?: number
}

export function resolveDeviceGap(opts?: DeviceStackLayoutOpts): number {
  const raw = opts?.deviceGap
  if (raw != null && Number.isFinite(raw)) {
    return Math.min(DEVICE_GAP_MAX, Math.max(DEVICE_GAP_MIN, raw))
  }
  return SIMPLE_DEVICE_GAP
}
export const CONTAINER_PAD = 12
export const CONTAINER_HEADER_H = 68
export const CONTAINER_SELECTOR_H = 40

export type SimpleDevicePortClick = {
  handleId: string
  label: string
  side: 'source' | 'target'
}

export type PortConnectDragPhase = 'move' | 'end' | 'cancel'

export type PortConnectDragParams = {
  phase: PortConnectDragPhase
  handleId: string
  label: string
  clientX: number
  clientY: number
}

export type SimpleDeviceNodeData = {
  label: string
  deviceType: string | null
  ipAddress: string | null
  status: string
  accentColor: string
  portsInUse?: number
  portCount?: number
  readOnly?: boolean
  slots?: DiagramPortSlot[]
  handleAnchors?: Record<string, DiagramHandleAnchor>
  onRemove?: () => void
  onPortClick?: (params: SimpleDevicePortClick) => void
  onDeviceDoubleClick?: () => void
  onHandleAnchorChange?: (handleId: string, anchor: DiagramHandleAnchor) => void
  onHandleAnchorChangeEnd?: (handleId: string, anchor: DiagramHandleAnchor) => void
  /** Batch update after a port anchor commit. */
  onSlotsReorder?: (slots: DiagramPortSlot[]) => void
  onRedistributePorts?: () => void
  /** Pointer left the device: preview or finish a link to another port. */
  onPortConnectDrag?: (params: PortConnectDragParams) => void
  [key: string]: unknown
}

export type SimpleDeviceNodeType = Node<SimpleDeviceNodeData, 'simpleDevice'>

export function estimateDeviceNameLines(
  label: string,
  nodeWidth = SIMPLE_DEVICE_WIDTH,
): number {
  const chrome = 16 + 22
  const usable = Math.max(80, nodeWidth - chrome)
  const charsPerLine = Math.max(10, Math.floor(usable / DIAGRAM_DEVICE_CHAR_PX))
  return Math.min(5, Math.max(1, Math.ceil((label || ' ').length / charsPerLine)))
}

export function simpleDeviceHeight(
  portRows = 0,
  label = '',
  nodeWidth = SIMPLE_DEVICE_WIDTH,
  compact = false,
): number {
  const rows = Math.max(0, portRows)
  const rowH = compact ? SIMPLE_DEVICE_PORT_ROW_COMPACT_H : SIMPLE_DEVICE_PORT_ROW_H
  const nameLines = estimateDeviceNameLines(label, nodeWidth)
  const nameBlock = nameLines * SIMPLE_DEVICE_NAME_LINE_H + 4
  const header = nameBlock + SIMPLE_DEVICE_META_H
  if (rows <= 0) return Math.max(SIMPLE_DEVICE_BASE_H, header + 8)
  return Math.max(SIMPLE_DEVICE_BASE_H, header + rows * rowH + 8)
}

export function devicePortAreaTop(
  label: string,
  portRowCount: number,
  portCount: number,
  nodeWidth = SIMPLE_DEVICE_WIDTH,
): number {
  if (portRowCount <= 0) return 0
  const nameLines = estimateDeviceNameLines(label, nodeWidth)
  const nameBlockH = nameLines * SIMPLE_DEVICE_NAME_LINE_H + 4
  const showPortCounter = portCount > 0
  return nameBlockH + (showPortCounter ? SIMPLE_DEVICE_META_H : 0)
}

export type SavedDeviceExtent = {
  width?: number
  height?: number
}

export function resolveDeviceNodeSize(
  autoHeight: number,
  saved?: SavedDeviceExtent | null,
): { width: number; height: number } {
  const rawW = saved?.width
  const rawH = saved?.height
  const width =
    rawW != null && Number.isFinite(rawW) && rawW > 0
      ? Math.max(SIMPLE_DEVICE_MIN_WIDTH, rawW)
      : SIMPLE_DEVICE_WIDTH
  const height =
    rawH != null && Number.isFinite(rawH) && rawH > 0
      ? Math.max(autoHeight, rawH)
      : autoHeight
  return { width, height }
}

const HANDLE_DRAG_THRESHOLD_PX = 4
/** Local px past the border box before a port drag becomes a link gesture. */
const PORT_CONNECT_OUTSIDE_MARGIN = 36
const ANCHOR_TRANSITION = 'top 180ms ease, left 180ms ease, bottom 180ms ease, right 180ms ease, transform 180ms ease'

type PortGesture = 'pending' | 'anchor' | 'connect'

type PortAnchorProps = {
  slot: DiagramPortSlot
  nodeWidth: number
  nodeHeight: number
  canDrag: boolean
  canClick: boolean
  draggingId: string | null
  onPortClick?: () => void
  onAnchorLive?: (anchor: DiagramHandleAnchor) => void
  onAnchorCommit?: (anchor: DiagramHandleAnchor) => void
  onAnchorRevert?: () => void
  onPortConnectDrag?: (params: PortConnectDragParams) => void
}

function PortAnchorHandle({
  slot,
  canDrag,
  canClick,
  draggingId,
  onPortClick,
  onAnchorLive,
  onAnchorCommit,
  onAnchorRevert,
  onPortConnectDrag,
  nodeWidth,
  nodeHeight,
}: PortAnchorProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null)
  const gestureRef = useRef<PortGesture>('pending')
  const [gesture, setGesture] = useState<PortGesture>('pending')
  const zoom = useStore((s) => s.transform[2] || 1)
  const anchor = slot.anchor
  const { position, style } = anchorToHandleStyle(
    anchor,
    nodeWidth,
    nodeHeight,
    DEVICE_NODE_INSET
  )
  const labelStyle = anchorToLabelStyle(anchor, nodeWidth, nodeHeight, DEVICE_NODE_INSET)
  const isDragging = draggingId === slot.id || gesture === 'anchor'
  const connected = slot.connected

  const localFromEvent = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      const shell = shellRef.current?.parentElement
      if (!shell) return null
      // shell is the padding box; convert screen px → border-box flow coords
      const rect = shell.getBoundingClientRect()
      const z = zoom > 0 ? zoom : 1
      return {
        x: (clientX - rect.left) / z + DEVICE_NODE_INSET.left,
        y: (clientY - rect.top) / z + DEVICE_NODE_INSET.top,
      }
    },
    [zoom]
  )

  const connectParams = (clientX: number, clientY: number, phase: PortConnectDragPhase) => ({
    phase,
    handleId: slot.id,
    label: slot.label,
    clientX,
    clientY,
  })

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!canDrag) return
    e.stopPropagation()
    e.preventDefault()
    pointerDownRef.current = { x: e.clientX, y: e.clientY }
    gestureRef.current = 'pending'
    setGesture('pending')
    const target = e.currentTarget as HTMLElement
    try {
      if (!target.hasPointerCapture(e.pointerId)) target.setPointerCapture(e.pointerId)
    } catch {
      // Synthetic events have no active pointer; the gesture still follows the target.
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!canDrag || !pointerDownRef.current) return
    const dx = e.clientX - pointerDownRef.current.x
    const dy = e.clientY - pointerDownRef.current.y
    if (
      gestureRef.current === 'pending' &&
      Math.hypot(dx, dy) < HANDLE_DRAG_THRESHOLD_PX
    ) {
      return
    }
    const local = localFromEvent(e.clientX, e.clientY)
    if (!local) return
    const outside =
      local.x < -PORT_CONNECT_OUTSIDE_MARGIN ||
      local.y < -PORT_CONNECT_OUTSIDE_MARGIN ||
      local.x > nodeWidth + PORT_CONNECT_OUTSIDE_MARGIN ||
      local.y > nodeHeight + PORT_CONNECT_OUTSIDE_MARGIN

    if (outside) {
      if (gestureRef.current !== 'connect') {
        gestureRef.current = 'connect'
        setGesture('connect')
        onAnchorRevert?.()
      }
      e.stopPropagation()
      onPortConnectDrag?.(connectParams(e.clientX, e.clientY, 'move'))
      return
    }

    if (gestureRef.current === 'connect') {
      onPortConnectDrag?.(connectParams(e.clientX, e.clientY, 'cancel'))
    }
    if (gestureRef.current !== 'anchor') {
      gestureRef.current = 'anchor'
      setGesture('anchor')
    }
    e.stopPropagation()
    onAnchorLive?.(projectPointerToPerimeter(local.x, local.y, nodeWidth, nodeHeight))
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!canDrag || !pointerDownRef.current) return
    e.stopPropagation()
    const target = e.currentTarget as HTMLElement
    if (target.hasPointerCapture?.(e.pointerId)) {
      try {
        target.releasePointerCapture(e.pointerId)
      } catch {
        // Already released, or the event was synthetic.
      }
    }
    const mode = gestureRef.current
    if (mode === 'connect') {
      onPortConnectDrag?.(connectParams(e.clientX, e.clientY, 'end'))
      onAnchorRevert?.()
    } else if (mode === 'anchor') {
      const local = localFromEvent(e.clientX, e.clientY)
      if (local) {
        onAnchorCommit?.(projectPointerToPerimeter(local.x, local.y, nodeWidth, nodeHeight))
      } else {
        onAnchorRevert?.()
      }
    }
    pointerDownRef.current = null
    gestureRef.current = 'pending'
    setGesture('pending')
  }

  const handleClass = connected
    ? '!bg-blue-500 !border-blue-600'
    : '!bg-white !border-slate-300 dark:!bg-slate-900 dark:!border-slate-500'
  const handleSizeClass = connected ? '!h-2.5 !w-2.5' : '!h-2 !w-2'

  const transitionStyle = isDragging ? {} : { transition: ANCHOR_TRANSITION }

  return (
    <div ref={shellRef} className="pointer-events-none absolute inset-0">
      <Handle
        type="target"
        position={position}
        id={`${slot.id}::in`}
        className={`!z-10 ${handleSizeClass} !border-2 !opacity-0 nodrag nopan`}
        style={{ ...style, pointerEvents: 'none' }}
        isConnectable
      />
      <Handle
        type="source"
        position={position}
        id={slot.id}
        className={`!z-20 ${handleSizeClass} !border-2 ${handleClass} nodrag nopan ${
          canDrag
            ? gesture === 'connect'
              ? 'cursor-crosshair'
              : gesture === 'anchor' || isDragging
                ? 'cursor-grabbing'
                : 'cursor-grab'
            : ''
        }`}
        style={{ ...style, ...transitionStyle, pointerEvents: 'auto' }}
        isConnectable
        isConnectableStart={false}
        title={
          canDrag ? `${slot.label} — arrastrá para mover o conectar` : slot.label
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
      <button
        type="button"
        className={`nodrag nopan z-10 truncate rounded font-semibold leading-tight ${
          canClick
            ? connected
              ? 'cursor-pointer text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40'
              : 'cursor-pointer text-slate-400 hover:bg-slate-50 hover:text-blue-600 dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-blue-400'
            : connected
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-400 dark:text-slate-500'
        }`}
        style={{ ...labelStyle, ...transitionStyle }}
        title={
          canClick
            ? slot.connected
              ? `Nuevo enlace desde ${slot.label}`
              : `Crear enlace en ${slot.label}`
            : slot.label
        }
        disabled={!canClick}
        onClick={(e) => {
          e.stopPropagation()
          onPortClick?.()
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {slot.label}
      </button>
    </div>
  )
}

function SimpleDeviceNodeComponent({
  id,
  data,
  selected,
  width,
  height,
}: NodeProps<SimpleDeviceNodeType>) {
  const updateNodeInternals = useUpdateNodeInternals()
  const canReorder = !data.readOnly
  const slots = data.slots ?? []
  const showPortRows = slots.length > 0
  const nodeWidth = Number(width) > 0 ? Number(width) : SIMPLE_DEVICE_WIDTH
  const hasCompact = slots.some((s) => !s.connected)
  const portRows = showPortRows
    ? Math.max(
        ...['left', 'right', 'top', 'bottom'].map(
          (side) => slots.filter((s) => s.anchor.side === side).length
        ),
        1
      )
    : 0
  const contentMinH = simpleDeviceHeight(
    portRows,
    data.label,
    nodeWidth,
    hasCompact && slots.every((s) => !s.connected)
  )
  const displayHeight = Number(height) > 0 ? Math.max(Number(height), contentMinH) : contentMinH
  const canResize = !data.readOnly
  const canConnect = !data.readOnly && slots.length === 0
  const canClickPorts = !data.readOnly && Boolean(data.onPortClick)
  const canDragHandles =
    !data.readOnly &&
    (Boolean(data.onSlotsReorder) || Boolean(data.onHandleAnchorChange))
  const canDoubleClickLink = !data.readOnly && Boolean(data.onDeviceDoubleClick)
  const portCount = data.portCount ?? 0
  const portsInUse = data.portsInUse ?? 0
  const showPortCounter = portCount > 0
  const nameLines = estimateDeviceNameLines(data.label, nodeWidth)
  const nameBlockH = nameLines * SIMPLE_DEVICE_NAME_LINE_H + 4

  const [liveSlots, setLiveSlots] = useState<DiagramPortSlot[] | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const displaySlots = liveSlots ?? slots
  /** Slots prop at the moment of a commit; cleared once the parent publishes new slots. */
  const pendingSlotsRef = useRef<DiagramPortSlot[] | null>(null)

  const [menuOpen, setMenuOpen] = useState(false)

  // RF caches handleBounds; custom CSS positions need a remesaure when anchors/size change.
  useEffect(() => {
    updateNodeInternals(id)
  }, [
    id,
    updateNodeInternals,
    nodeWidth,
    displayHeight,
    displaySlots,
  ])

  const emitPortClick = (slot: DiagramPortSlot) => {
    if (!canClickPorts) return
    const side: 'source' | 'target' = slot.role === 'target' ? 'target' : 'source'
    data.onPortClick?.({ handleId: slot.id, label: slot.label, side })
  }

  useEffect(() => {
    if (!pendingSlotsRef.current) return
    if (slots === pendingSlotsRef.current) return
    pendingSlotsRef.current = null
    setLiveSlots(null)
    setDraggingId(null)
  }, [slots])

  const revertAnchor = () => {
    pendingSlotsRef.current = null
    setLiveSlots(null)
    setDraggingId(null)
  }

  const handleAnchorCommit = (handleId: string, projected: DiagramHandleAnchor) => {
    const updated = slots.map((s) =>
      s.id === handleId ? { ...s, anchor: projected, side: projected.side } : s
    )
    pendingSlotsRef.current = slots
    setLiveSlots(updated)
    setDraggingId(null)
    data.onSlotsReorder?.(updated)
    data.onHandleAnchorChangeEnd?.(handleId, projected)
  }

  return (
    <div
      className={`relative rounded-md border bg-white shadow-sm dark:bg-slate-900 ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-400/40'
          : 'border-slate-300 dark:border-slate-600'
      } ${canReorder ? 'cursor-grab active:cursor-grabbing' : ''}`}
      style={{
        width: nodeWidth,
        height: displayHeight,
        borderLeftWidth: DEVICE_NODE_ACCENT_BORDER,
        borderLeftColor: data.accentColor,
      }}
      title={
        canDoubleClickLink
          ? 'Doble clic para crear enlace'
          : canReorder
            ? 'Arrastrá para reubicar · redimensioná desde las esquinas'
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
      {canResize ? (
        <NodeResizer
          minWidth={SIMPLE_DEVICE_MIN_WIDTH}
          minHeight={contentMinH}
          isVisible={selected}
          keepAspectRatio={false}
          lineClassName="!pointer-events-none !opacity-0"
          lineStyle={{ opacity: 0, pointerEvents: 'none' }}
          handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-2 !border-blue-500 !bg-white dark:!bg-slate-900"
        />
      ) : null}

      {displaySlots.map((slot) => (
        <PortAnchorHandle
          key={slot.id}
          slot={slot}
          nodeWidth={nodeWidth}
          nodeHeight={displayHeight}
          canDrag={canDragHandles}
          canClick={canClickPorts}
          draggingId={draggingId}
          onPortClick={() => emitPortClick(slot)}
          onAnchorLive={(next) => {
            setDraggingId(slot.id)
            setLiveSlots((prev) => {
              const base = prev ?? slots
              return base.map((s) =>
                s.id === slot.id ? { ...s, anchor: next, side: next.side } : s
              )
            })
          }}
          onAnchorCommit={(next) => handleAnchorCommit(slot.id, next)}
          onAnchorRevert={revertAnchor}
          onPortConnectDrag={
            data.onPortConnectDrag
              ? (params) => data.onPortConnectDrag?.(params)
              : undefined
          }
        />
      ))}

      {canConnect ? (
        <>
          <Handle
            type="target"
            position={Position.Left}
            id={DIAGRAM_CONNECT_TARGET_HANDLE}
            className="!z-0 !h-2.5 !w-2.5 !border-0 !bg-blue-500 nodrag nopan"
            style={{
              left: 0 - DEVICE_NODE_INSET.left,
              top: displayHeight / 2 - DEVICE_NODE_INSET.top,
              right: 'auto',
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
            }}
            isConnectable
          />
          <Handle
            type="source"
            position={Position.Right}
            id={DIAGRAM_CONNECT_SOURCE_HANDLE}
            className="!z-0 !h-2.5 !w-2.5 !border-0 !bg-blue-500 nodrag nopan"
            style={{
              left: nodeWidth - DEVICE_NODE_INSET.left,
              top: displayHeight / 2 - DEVICE_NODE_INSET.top,
              right: 'auto',
              bottom: 'auto',
              transform: 'translate(-50%, -50%)',
            }}
            isConnectable
          />
        </>
      ) : null}

      <div className="flex h-full flex-col px-2 py-1">
        <div className="flex items-start gap-1" style={{ minHeight: nameBlockH }}>
          <div
            className={`min-w-0 flex-1 break-all ${DIAGRAM_DEVICE_NAME} text-slate-900 dark:text-slate-100`}
            title={data.label}
          >
            {data.label}
          </div>
          {!data.readOnly && (data.onRemove || data.onRedistributePorts) ? (
            <div className="relative shrink-0">
              <button
                type="button"
                title="Opciones del equipo"
                className="nodrag nopan rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuOpen((v) => !v)
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>
              {menuOpen ? (
                <div className="nodrag nopan absolute right-0 top-full z-50 mt-0.5 min-w-[10rem] rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
                  {data.onRedistributePorts ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(false)
                        data.onRedistributePorts?.()
                      }}
                    >
                      Restaurar puertos
                    </button>
                  ) : null}
                  {data.onRemove ? (
                    <button
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                      onClick={(e) => {
                        e.stopPropagation()
                        setMenuOpen(false)
                        data.onRemove?.()
                      }}
                    >
                      Sacar del diagrama
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        {showPortCounter ? (
          <div className="flex items-center" style={{ height: SIMPLE_DEVICE_META_H }}>
            <span
              className={`whitespace-nowrap ${DIAGRAM_DEVICE_META} text-slate-500 dark:text-slate-400`}
              title={`${portsInUse} de ${portCount} puertos con enlace en este diagrama`}
            >
              {portsInUse} / {portCount} puertos
            </span>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const SimpleDeviceNode = memo(SimpleDeviceNodeComponent)
