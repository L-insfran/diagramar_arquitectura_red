import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  useViewport,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import {
  useCallback,
  useContext,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { TopologyCanvasInteractionContext } from './TopologyCanvasContext'
import type { MediumType } from '../../types'

/** Miembro de un enlace agrupado (mismo origen → mismo destino). */
export type PortLinkBundleMember = {
  id: string
  sourcePort: string
  targetPort: string
  sourceColor: string
  targetColor: string
  mediumType: MediumType
  mediumLabel: string
  connectionStatus: string
  networkLabel?: string
  vlanLabel?: string
}

export type PortLinkEdgeData = {
  sourcePort: string
  targetPort: string
  sourceColor: string
  targetColor: string
  sourceFanIndex: number
  sourceFanCount: number
  targetFanIndex: number
  targetFanCount: number
  pairLinkIndex: number
  pairLinkCount: number
  mediumType: MediumType
  mediumLabel: string
  connectionStatus: string
  networkLabel?: string
  vlanLabel?: string
  labelOffsetX?: number
  labelOffsetY?: number
  /** Si hay varias conexiones entre el mismo par de equipos, un solo trazo y esta lista en la etiqueta. */
  bundleMembers?: PortLinkBundleMember[]
}

export type PortLinkEdgeType = Edge<PortLinkEdgeData, 'portLink'>

/** Separación horizontal entre enlaces que comparten el mismo nodo (evita el bloque sólido). */
const FAN_SPACING_BASE = 68
const LABEL_CLICK_MAX_PX = 8
const PAIR_LABEL_STAGGER_X = 28
/** Desplaza etiquetas en Y según el índice del carril para que no se amontonen en el mismo punto. */
const FAN_LABEL_Y_STEP = 28

function laneOffset(index: number, count: number): number {
  if (count <= 1) return 0
  const extra = count > 8 ? 26 : count > 4 ? 14 : 0
  const step = FAN_SPACING_BASE + extra
  return (index - (count - 1) / 2) * step
}

/** Ancla la etiqueta sobre la columna real del cable (no solo el punto medio genérico del path). */
function labelAnchorXY(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  sourceOffset: number,
  labelX: number,
  labelY: number
): { x: number; y: number } {
  switch (sourcePosition) {
    case Position.Bottom:
    case Position.Top:
      return { x: sourceX + sourceOffset, y: labelY }
    case Position.Left:
    case Position.Right:
      return { x: labelX, y: sourceY + sourceOffset }
    default:
      return { x: labelX, y: labelY }
  }
}

const HANDLE_BRIDGE_EPS = 0.5

function smoothStepPathWithHandleBridges(
  sourceX: number,
  sourceY: number,
  sourcePosition: Position,
  sourceOffset: number,
  targetX: number,
  targetY: number,
  targetPosition: Position,
  targetOffset: number,
  borderRadius: number
): [path: string, labelX: number, labelY: number] {
  const [innerPath, labelX, labelY] = getSmoothStepPath({
    sourceX: sourceX + sourceOffset,
    sourceY,
    sourcePosition,
    targetX: targetX + targetOffset,
    targetY,
    targetPosition,
    borderRadius,
  })

  let path = innerPath
  if (Math.abs(sourceOffset) > HANDLE_BRIDGE_EPS) {
    const tail = innerPath.replace(/^M\s*[\d.-]+\s+[\d.-]+/i, '').trimStart()
    path = `M ${sourceX} ${sourceY} L ${sourceX + sourceOffset} ${sourceY} ${tail}`
  }
  if (Math.abs(targetOffset) > HANDLE_BRIDGE_EPS) {
    path = `${path} L ${targetX} ${targetY}`
  }
  return [path, labelX, labelY]
}

const MEDIUM_BADGE_CONFIG: Record<MediumType, { bg: string; text: string; border: string; icon: string }> = {
  utp: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', icon: '🔌' },
  fiber: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-800', icon: '💡' },
  wifi: { bg: 'bg-green-50 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-800', icon: '📶' },
}

const STATUS_DOT: Record<string, string> = {
  planned: 'bg-yellow-400',
  implemented: 'bg-blue-400',
  verified: 'bg-emerald-400',
}

/** Reparte ítems en 2 o 4 columnas para evitar scroll vertical en agrupaciones grandes. */
function bundleGridColumnCount(memberCount: number): 2 | 4 {
  return memberCount > 8 ? 4 : 2
}

export function PortLinkEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  interactionWidth,
  data,
}: EdgeProps<PortLinkEdgeType>) {
  const d = data as PortLinkEdgeData | undefined
  const sourceFanIndex = d?.sourceFanIndex ?? 0
  const sourceFanCount = d?.sourceFanCount ?? 1
  const targetFanIndex = d?.targetFanIndex ?? 0
  const targetFanCount = d?.targetFanCount ?? 1
  const pairLinkIndex = d?.pairLinkIndex ?? 0
  const pairLinkCount = d?.pairLinkCount ?? 1

  const sourceOffset = laneOffset(sourceFanIndex, sourceFanCount)
  const targetOffset = laneOffset(targetFanIndex, targetFanCount)

  const [edgePath, labelX, labelY] = smoothStepPathWithHandleBridges(
    sourceX, sourceY, sourcePosition, sourceOffset,
    targetX, targetY, targetPosition, targetOffset, 14
  )

  const bundleMembers = d?.bundleMembers
  const isBundle = bundleMembers != null && bundleMembers.length > 1

  const sourcePort = d?.sourcePort ?? '—'
  const targetPort = d?.targetPort ?? '—'
  const sourceColor = d?.sourceColor ?? '#64748b'
  const targetColor = d?.targetColor ?? '#64748b'
  const mediumType = d?.mediumType ?? 'utp'
  const mediumLabel = d?.mediumLabel ?? ''
  const connectionStatus = d?.connectionStatus ?? 'implemented'
  const networkLabel = d?.networkLabel
  const vlanLabel = d?.vlanLabel
  const storedLabelX = d?.labelOffsetX ?? 0
  const storedLabelY = d?.labelOffsetY ?? 0

  const badgeConfig = MEDIUM_BADGE_CONFIG[mediumType]
  const statusDot = STATUS_DOT[connectionStatus] ?? 'bg-gray-400'

  const interaction = useContext(TopologyCanvasInteractionContext)
  const readOnly = interaction?.readOnly ?? true
  const commitLabelOffset = interaction?.commitLabelOffset
  const onNavigateToConnection = interaction?.onNavigateToConnection
  const { zoom } = useViewport()

  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{
    pointerId: number; startClientX: number; startClientY: number; baseX: number; baseY: number
  } | null>(null)

  const canDragLabel = !readOnly && !!commitLabelOffset

  const strokeColor =
    typeof style?.stroke === 'string' && style.stroke.length > 0 ? style.stroke : '#3b82f6'

  const onLabelPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (readOnly || !commitLabelOffset) return
      e.stopPropagation()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      dragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, baseX: storedLabelX, baseY: storedLabelY }
      setDragDelta({ x: 0, y: 0 })
    },
    [readOnly, commitLabelOffset, storedLabelX, storedLabelY]
  )

  const onLabelPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      setDragDelta({ x: (e.clientX - drag.startClientX) / zoom, y: (e.clientY - drag.startClientY) / zoom })
    },
    [zoom]
  )

  const endDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* */ }
      dragRef.current = null
      if (e.type === 'pointercancel') { setDragDelta({ x: 0, y: 0 }); return }
      const distClient = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY)
      if (distClient < LABEL_CLICK_MAX_PX && onNavigateToConnection && !isBundle) {
        setDragDelta({ x: 0, y: 0 })
        onNavigateToConnection(id)
        return
      }
      const dx = (e.clientX - drag.startClientX) / zoom
      const dy = (e.clientY - drag.startClientY) / zoom
      setDragDelta({ x: 0, y: 0 })
      commitLabelOffset?.(id, drag.baseX + dx, drag.baseY + dy)
    },
    [zoom, id, commitLabelOffset, onNavigateToConnection, isBundle]
  )

  const handleLabelClick = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      if (canDragLabel) return
      if (!onNavigateToConnection || isBundle) return
      e.stopPropagation()
      onNavigateToConnection(id)
    },
    [canDragLabel, onNavigateToConnection, id, isBundle]
  )

  const pairStagger = pairLinkCount > 1 ? pairLinkIndex - (pairLinkCount - 1) / 2 : 0
  const fanVert =
    sourceFanCount > 1 ? (sourceFanIndex - (sourceFanCount - 1) / 2) * FAN_LABEL_Y_STEP : 0
  const { x: anchorX, y: anchorYBase } = labelAnchorXY(
    sourceX, sourceY, sourcePosition, sourceOffset, labelX, labelY
  )
  const labelShiftX = pairStagger * PAIR_LABEL_STAGGER_X + storedLabelX + dragDelta.x
  const labelShiftY = fanVert + storedLabelY + dragDelta.y

  const labelTitle = isBundle
    ? (canDragLabel ? 'Clic en un enlace para editar · Arrastrar para mover la etiqueta' : 'Clic en un enlace para ver la conexión')
    : onNavigateToConnection
      ? (canDragLabel ? 'Clic para abrir · Arrastrar para mover' : 'Clic para abrir la conexión')
      : canDragLabel ? 'Arrastrar para ajustar posición' : undefined

  const labelTransform = `translate(-50%, -50%) translate(${anchorX + labelShiftX}px,${anchorYBase + labelShiftY}px)`

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} interactionWidth={interactionWidth ?? 24} />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: labelTransform,
            pointerEvents: 'all',
            zIndex: 50,
          }}
        >
          <div
            className={`rounded-lg border-2 bg-white px-2.5 py-1.5 text-sm font-medium shadow-lg dark:bg-gray-900 ${
              isBundle ? 'max-w-[min(94vw,720px)]' : 'max-w-[min(100vw,280px)]'
            } ${
              canDragLabel ? 'cursor-grab active:cursor-grabbing' : onNavigateToConnection && !isBundle ? 'cursor-pointer' : ''
            }`}
            style={{ borderColor: strokeColor, boxShadow: `0 4px 14px rgba(0,0,0,0.12), 0 0 0 1px ${strokeColor}33` }}
            title={labelTitle}
            onClick={handleLabelClick}
            onPointerDown={onLabelPointerDown}
            onPointerMove={onLabelPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            {isBundle && bundleMembers ? (
              <>
                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 mb-1 dark:border-gray-600">
                  <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: strokeColor }} title="Enlace agrupado" />
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                    {bundleMembers.length} enlaces
                  </span>
                </div>
                <ul
                  className={`grid gap-1 text-left ${
                    bundleGridColumnCount(bundleMembers.length) === 4 ? 'grid-cols-4' : 'grid-cols-2'
                  }`}
                >
                  {bundleMembers.map((m) => {
                    const rowBadge = MEDIUM_BADGE_CONFIG[m.mediumType]
                    const rowStatus = STATUS_DOT[m.connectionStatus] ?? 'bg-gray-400'
                    return (
                      <li key={m.id} className="min-w-0">
                        <button
                          type="button"
                          disabled={!onNavigateToConnection}
                          onClick={(e) => {
                            e.stopPropagation()
                            onNavigateToConnection?.(m.id)
                          }}
                          className={`flex h-full min-h-0 w-full min-w-0 flex-col gap-0.5 rounded-md border border-gray-200 bg-gray-50/90 px-1.5 py-1 text-left transition dark:border-gray-700 dark:bg-gray-800/80 ${
                            onNavigateToConnection ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : 'cursor-default opacity-90'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-0.5">
                            <span style={{ color: m.sourceColor }} className="truncate font-mono text-[10px] font-semibold leading-tight">{m.sourcePort}</span>
                            <span className="shrink-0 text-gray-400 dark:text-gray-500 text-[9px]">→</span>
                            <span style={{ color: m.targetColor }} className="truncate font-mono text-[10px] font-semibold leading-tight">{m.targetPort}</span>
                            <span className={`ml-auto size-1.5 shrink-0 rounded-full ${rowStatus}`} title={m.connectionStatus} />
                          </div>
                          <span className={`inline-flex min-w-0 max-w-full items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold leading-tight ${rowBadge.text} ${rowBadge.bg}`}>
                            <span aria-hidden className="shrink-0">{rowBadge.icon}</span>
                            <span className="truncate">{m.mediumLabel}</span>
                          </span>
                          {(m.networkLabel || m.vlanLabel) && (
                            <div className="min-w-0 text-[8px] leading-tight text-gray-600 dark:text-gray-400">
                              {m.networkLabel && <span className="block truncate">Red: {m.networkLabel}</span>}
                              {m.vlanLabel && <span className="block truncate">VLAN: {m.vlanLabel}</span>}
                            </div>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 mb-1 dark:border-gray-600">
                  <span className="inline-block size-2 shrink-0 rounded-full" style={{ backgroundColor: strokeColor }} title="Enlace" />
                  <span style={{ color: sourceColor }} className="font-mono text-xs font-semibold">{sourcePort}</span>
                  <span className="text-gray-400 dark:text-gray-500 text-xs">→</span>
                  <span style={{ color: targetColor }} className="font-mono text-xs font-semibold">{targetPort}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${badgeConfig.text} ${badgeConfig.bg}`}>
                    <span aria-hidden>{badgeConfig.icon}</span>
                    {mediumLabel}
                  </span>
                  <span className={`size-2 rounded-full ${statusDot}`} title={connectionStatus} />
                </div>
                {(networkLabel || vlanLabel) && (
                  <div className="mt-1 space-y-0.5 text-[10px] text-gray-600 dark:text-gray-300">
                    {networkLabel && <p className="truncate">Red: <span className="font-normal">{networkLabel}</span></p>}
                    {vlanLabel && <p className="truncate">VLAN: <span className="font-normal">{vlanLabel}</span></p>}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
