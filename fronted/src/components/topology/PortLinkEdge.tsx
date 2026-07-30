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
  portRole?: 'trunk' | 'access'
}

export type PortLinkEdgeData = {
  sourcePort: string
  targetPort: string
  sourcePortId?: string
  targetPortId?: string
  sourceColor: string
  targetColor: string
  sourcePortNumber?: number
  targetPortNumber?: number
  sourcePortCount?: number
  sourceExitSide?: 'top' | 'bottom'
  targetEntrySide?: 'top' | 'bottom'
  sourceLaneOffsetX?: number
  targetLaneOffsetX?: number
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
  portRole?: 'trunk' | 'access'
  labelOffsetX?: number
  labelOffsetY?: number
  pathBendX?: number
  pathBendY?: number
  bundleMembers?: PortLinkBundleMember[]
  usePortHandles?: boolean
}

export type PortLinkEdgeType = Edge<PortLinkEdgeData, 'portLink'>

const FAN_SPACING_BASE = 80
const LABEL_CLICK_MAX_PX = 8
const PAIR_LABEL_STAGGER_X = 32
const FAN_LABEL_Y_STEP = 32
/** Distancia desde el borde del nodo hasta la etiqueta, en el sentido de salida. */
const LABEL_EXIT_GAP = 34
/** Separación extra entre etiquetas de filas distintas en un patch de 24. */
const PATCH_LABEL_ROW_GAP = 28

/**
 * Etiqueta anclada a la columna del puerto y al lado por el que sale el cable.
 * Arriba si el cable sube; abajo si baja. Así se lee de qué puerto sale cada enlace.
 */
function labelAnchorAtPortExit(
  sourceX: number,
  sourceY: number,
  targetY: number,
  sourceLaneOffsetX: number,
  sourceExitSide: 'top' | 'bottom' | undefined,
  sourcePortNumber?: number,
  sourcePortCount?: number,
): { x: number; y: number } {
  const exitsUp = sourceExitSide === 'top' || (sourceExitSide == null && targetY < sourceY)
  const rowExtra =
    sourcePortNumber != null && sourcePortCount != null && sourcePortCount > 12
      ? sourcePortNumber <= 12
        ? exitsUp ? 0 : PATCH_LABEL_ROW_GAP
        : exitsUp ? PATCH_LABEL_ROW_GAP : 0
      : 0
  const y = exitsUp
    ? sourceY - LABEL_EXIT_GAP - rowExtra
    : sourceY + LABEL_EXIT_GAP + rowExtra
  return { x: sourceX + sourceLaneOffsetX, y }
}

function laneOffset(index: number, count: number): number {
  if (count <= 1) return 0
  const extra = count > 8 ? 26 : count > 4 ? 14 : 0
  const step = FAN_SPACING_BASE + extra
  return (index - (count - 1) / 2) * step
}

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

type Pt = { x: number; y: number }

/** Tramo recto mínimo antes de entrar o salir de un puerto. */
const CABLE_STUB = 16
const CABLE_RADIUS = 8
/** Ancho del desvío lateral cuando el destino queda por encima del origen. */
const CABLE_BACKTRACK_X = 130

function dedupePoints(points: Pt[]): Pt[] {
  const out: Pt[] = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) continue
    out.push(point)
  }
  return out
}

function shiftToward(from: Pt, to: Pt, distance: number): Pt {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length === 0 || distance === 0) return { x: from.x, y: from.y }
  const ratio = Math.min(distance, length) / length
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

/** Convierte una polilínea en 90° a un trazo SVG con esquinas redondeadas. */
function roundedOrthogonalPath(points: Pt[], radius: number): string {
  const pts = dedupePoints(points)
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`

  let path = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1]
    const corner = pts[i]
    const next = pts[i + 1]
    const maxRadius = Math.min(
      radius,
      Math.hypot(corner.x - prev.x, corner.y - prev.y) / 2,
      Math.hypot(next.x - corner.x, next.y - corner.y) / 2,
    )
    const entry = shiftToward(corner, prev, maxRadius)
    const exit = shiftToward(corner, next, maxRadius)
    path += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`
  }
  const end = pts[pts.length - 1]
  return `${path} L ${end.x} ${end.y}`
}

/**
 * Cable entre handles de cada puerto (celda → celda).
 * Sale del puerto, baja/sube por su vía y entra en el puerto destino.
 */
function portCablePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourceLaneOffsetX: number,
  targetLaneOffsetX: number,
  pathBendX: number,
  pathBendY: number,
): [path: string, controlX: number, controlY: number] {
  const sourceLaneX = sourceX + sourceLaneOffsetX + pathBendX
  const targetLaneX = targetX + targetLaneOffsetX + pathBendX

  // Destino por debajo: bajada limpia con cruce horizontal a media altura.
  if (targetY > sourceY + CABLE_STUB * 2) {
    const corridorY = Math.min(
      Math.max((sourceY + targetY) / 2 + pathBendY, sourceY + CABLE_STUB),
      targetY - CABLE_STUB,
    )
    const path = roundedOrthogonalPath(
      [
        { x: sourceX, y: sourceY },
        { x: sourceLaneX, y: sourceY },
        { x: sourceLaneX, y: corridorY },
        { x: targetLaneX, y: corridorY },
        { x: targetLaneX, y: targetY },
        { x: targetX, y: targetY },
      ],
      CABLE_RADIUS,
    )
    return [path, (sourceLaneX + targetLaneX) / 2, corridorY]
  }

  // Destino a la misma altura o por encima: rodea por un lateral cercano.
  const midX = (sourceX + targetX) / 2
  const side = targetX >= sourceX ? 1 : -1
  const corridorX =
    (Math.abs(targetX - sourceX) < CABLE_BACKTRACK_X ? midX + side * CABLE_BACKTRACK_X : midX) +
    pathBendX
  const exitY = sourceY + CABLE_STUB + Math.max(0, pathBendY)
  const entryY = targetY - CABLE_STUB
  const path = roundedOrthogonalPath(
    [
      { x: sourceX, y: sourceY },
      { x: sourceX, y: exitY },
      { x: corridorX, y: exitY },
      { x: corridorX, y: entryY },
      { x: targetX, y: entryY },
      { x: targetX, y: targetY },
    ],
    CABLE_RADIUS,
  )
  return [path, corridorX, (exitY + entryY) / 2]
}

const MEDIUM_BADGE_CONFIG: Record<MediumType, { bg: string; text: string; icon: string }> = {
  utp: { bg: 'bg-blue-50 dark:bg-blue-950/40', text: 'text-blue-800 dark:text-blue-200', icon: '🔌' },
  fiber: { bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-800 dark:text-orange-200', icon: '💡' },
  wifi: { bg: 'bg-green-50 dark:bg-green-950/40', text: 'text-green-800 dark:text-green-200', icon: '📶' },
  internet: { bg: 'bg-sky-50 dark:bg-sky-950/40', text: 'text-sky-800 dark:text-sky-200', icon: '☁️' },
}

const STATUS_DOT: Record<string, string> = {
  planned: 'bg-yellow-400',
  implemented: 'bg-blue-400',
  verified: 'bg-emerald-400',
}

function bundleGridColumnCount(memberCount: number): 2 | 4 {
  return memberCount > 8 ? 4 : 2
}

function buildFullTooltip(
  sourcePort: string,
  targetPort: string,
  mediumLabel: string,
  connectionStatus: string,
  networkLabel?: string,
  vlanLabel?: string,
  portRole?: 'trunk' | 'access',
): string {
  const lines = [`${sourcePort} → ${targetPort}`, mediumLabel, `Estado: ${connectionStatus}`]
  if (portRole) lines.push(portRole === 'trunk' ? 'Trunk' : 'Access')
  if (vlanLabel) lines.push(vlanLabel)
  if (networkLabel) lines.push(networkLabel)
  return lines.join('\n')
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
  const usePortHandles = d?.usePortHandles ?? false
  const sourceFanIndex = d?.sourceFanIndex ?? 0
  const sourceFanCount = d?.sourceFanCount ?? 1
  const targetFanIndex = d?.targetFanIndex ?? 0
  const targetFanCount = d?.targetFanCount ?? 1
  const pairLinkIndex = d?.pairLinkIndex ?? 0
  const pairLinkCount = d?.pairLinkCount ?? 1
  const sourceLaneOffsetX = d?.sourceLaneOffsetX ?? 0
  const targetLaneOffsetX = d?.targetLaneOffsetX ?? 0

  const sourceOffset = usePortHandles ? 0 : laneOffset(sourceFanIndex, sourceFanCount)
  const targetOffset = usePortHandles ? 0 : laneOffset(targetFanIndex, targetFanCount)

  const storedPathBendX = d?.pathBendX ?? 0
  const storedPathBendY = d?.pathBendY ?? 0

  let edgePath: string
  let labelX: number
  let labelY: number
  let controlX: number
  let controlY: number

  if (usePortHandles) {
    // Cada puerto tiene su propia vía; no se aplica spread por fan-out del nodo.
    ;[edgePath, controlX, controlY] = portCablePath(
      sourceX, sourceY, targetX, targetY,
      sourceLaneOffsetX, targetLaneOffsetX,
      storedPathBendX, storedPathBendY,
    )
    labelX = controlX
    labelY = controlY
  } else {
    ;[edgePath, labelX, labelY] = smoothStepPathWithHandleBridges(
      sourceX, sourceY, sourcePosition, sourceOffset,
      targetX, targetY, targetPosition, targetOffset, 14,
    )
    controlX = labelX
    controlY = labelY
  }

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
  const commitPathBend = interaction?.commitPathBend
  const onNavigateToConnection = interaction?.onNavigateToConnection
  const selection = interaction?.selection ?? null
  const { zoom } = useViewport()

  const [labelDragDelta, setLabelDragDelta] = useState({ x: 0, y: 0 })
  const [bendDragDelta, setBendDragDelta] = useState({ x: 0, y: 0 })
  const labelDragRef = useRef<{
    pointerId: number; startClientX: number; startClientY: number; baseX: number; baseY: number
  } | null>(null)
  const bendDragRef = useRef<{
    pointerId: number; startClientX: number; startClientY: number; baseX: number; baseY: number
  } | null>(null)

  const canDragLabel = !readOnly && !!commitLabelOffset
  const canDragPath = !readOnly && !!commitPathBend && usePortHandles

  const isHighlighted =
    selection?.kind === 'edge'
      ? id === selection.edgeId
      : selection?.kind === 'port'
        ? d?.sourcePortId === selection.portId || d?.targetPortId === selection.portId
        : false
  const isDimmed = selection != null && !isHighlighted

  const baseStroke =
    typeof style?.stroke === 'string' && style.stroke.length > 0 ? style.stroke : '#2563eb'
  const strokeColor = isHighlighted ? '#f59e0b' : baseStroke

  const edgeStyle = {
    ...style,
    stroke: strokeColor,
    strokeWidth: isHighlighted
      ? 4
      : mediumType === 'internet'
        ? 2.75
        : usePortHandles
          ? 2.25
          : (style?.strokeWidth ?? 2.25),
    strokeLinecap: 'round' as const,
    opacity: isDimmed ? 0.22 : 1,
    filter: isHighlighted ? 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.85))' : undefined,
    transition: 'stroke 120ms ease, stroke-width 120ms ease, opacity 120ms ease',
  }

  const onLabelPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (readOnly || !commitLabelOffset) return
      e.stopPropagation()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      labelDragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, baseX: storedLabelX, baseY: storedLabelY }
      setLabelDragDelta({ x: 0, y: 0 })
    },
    [readOnly, commitLabelOffset, storedLabelX, storedLabelY]
  )

  const onLabelPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = labelDragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      setLabelDragDelta({ x: (e.clientX - drag.startClientX) / zoom, y: (e.clientY - drag.startClientY) / zoom })
    },
    [zoom]
  )

  const endLabelDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = labelDragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* */ }
      labelDragRef.current = null
      if (e.type === 'pointercancel') { setLabelDragDelta({ x: 0, y: 0 }); return }
      const distClient = Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY)
      if (distClient < LABEL_CLICK_MAX_PX && onNavigateToConnection && !isBundle) {
        setLabelDragDelta({ x: 0, y: 0 })
        onNavigateToConnection(id)
        return
      }
      const dx = (e.clientX - drag.startClientX) / zoom
      const dy = (e.clientY - drag.startClientY) / zoom
      setLabelDragDelta({ x: 0, y: 0 })
      commitLabelOffset?.(id, drag.baseX + dx, drag.baseY + dy)
    },
    [zoom, id, commitLabelOffset, onNavigateToConnection, isBundle]
  )

  const onBendPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!canDragPath) return
      e.stopPropagation()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      bendDragRef.current = { pointerId: e.pointerId, startClientX: e.clientX, startClientY: e.clientY, baseX: storedPathBendX, baseY: storedPathBendY }
      setBendDragDelta({ x: 0, y: 0 })
    },
    [canDragPath, storedPathBendX, storedPathBendY]
  )

  const onBendPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = bendDragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      setBendDragDelta({ x: (e.clientX - drag.startClientX) / zoom, y: (e.clientY - drag.startClientY) / zoom })
    },
    [zoom]
  )

  const endBendDrag = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = bendDragRef.current
      if (!drag || e.pointerId !== drag.pointerId) return
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* */ }
      bendDragRef.current = null
      if (e.type === 'pointercancel') { setBendDragDelta({ x: 0, y: 0 }); return }
      const dx = (e.clientX - drag.startClientX) / zoom
      const dy = (e.clientY - drag.startClientY) / zoom
      setBendDragDelta({ x: 0, y: 0 })
      commitPathBend?.(id, drag.baseX + dx, drag.baseY + dy)
    },
    [zoom, id, commitPathBend]
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

  const pairStagger = !usePortHandles && pairLinkCount > 1 ? pairLinkIndex - (pairLinkCount - 1) / 2 : 0
  const fanVert =
    !usePortHandles && sourceFanCount > 1 ? (sourceFanIndex - (sourceFanCount - 1) / 2) * FAN_LABEL_Y_STEP : 0

  const portLabelAnchor = usePortHandles
    ? labelAnchorAtPortExit(
        sourceX,
        sourceY,
        targetY,
        sourceLaneOffsetX,
        d?.sourceExitSide,
        d?.sourcePortNumber,
        d?.sourcePortCount,
      )
    : null
  const pathLabelAnchor = labelAnchorXY(sourceX, sourceY, sourcePosition, sourceOffset, labelX, labelY)
  const anchorX = portLabelAnchor?.x ?? pathLabelAnchor.x
  const anchorYBase = portLabelAnchor?.y ?? pathLabelAnchor.y

  const labelShiftX = (usePortHandles ? storedLabelX : pairStagger * PAIR_LABEL_STAGGER_X + storedLabelX) + labelDragDelta.x
  const labelShiftY = (usePortHandles ? storedLabelY : fanVert + storedLabelY) + labelDragDelta.y

  const liveControlX = controlX + bendDragDelta.x
  const liveControlY = controlY + bendDragDelta.y
  const liveEdgePath =
    usePortHandles && (bendDragDelta.x !== 0 || bendDragDelta.y !== 0)
      ? portCablePath(
          sourceX, sourceY, targetX, targetY,
          sourceLaneOffsetX, targetLaneOffsetX,
          storedPathBendX + bendDragDelta.x, storedPathBendY + bendDragDelta.y,
        )[0]
      : edgePath

  const fullTooltip = buildFullTooltip(sourcePort, targetPort, mediumLabel, connectionStatus, networkLabel, vlanLabel, d?.portRole)

  const labelTitle = isBundle
    ? (canDragLabel ? 'Clic en enlace · Arrastrar etiqueta' : 'Clic en enlace')
    : usePortHandles
      ? `${fullTooltip}${canDragLabel ? '\n\nArrastrar etiqueta · Punto azul curva el cable' : ''}\nDoble clic para editar`
      : onNavigateToConnection
        ? (canDragLabel ? 'Clic abrir · Arrastrar etiqueta' : 'Doble clic para editar')
        : canDragLabel ? 'Arrastrar etiqueta' : fullTooltip

  const labelTransform = `translate(-50%, -50%) translate(${anchorX + labelShiftX}px,${anchorYBase + labelShiftY}px)`
  const bendTransform = `translate(-50%, -50%) translate(${liveControlX}px,${liveControlY}px)`

  // Etiquetas ocultas en vista de puertos: el enlace se lee por resaltado + tooltip / doble clic.
  const showLabels = !usePortHandles

  return (
    <>
      <BaseEdge
        id={id}
        path={liveEdgePath}
        style={edgeStyle}
        markerEnd={markerEnd}
        interactionWidth={interactionWidth ?? 22}
      />
      <EdgeLabelRenderer>
        {canDragPath && (
          <div
            className="nodrag nopan opacity-60 hover:opacity-100 transition-opacity"
            style={{ position: 'absolute', transform: bendTransform, pointerEvents: 'all', zIndex: 40 }}
          >
            <div
              className="size-2.5 rounded-full border border-white bg-blue-500 shadow cursor-grab active:cursor-grabbing dark:border-gray-800"
              title="Arrastrar para curvar el cable"
              onPointerDown={onBendPointerDown}
              onPointerMove={onBendPointerMove}
              onPointerUp={endBendDrag}
              onPointerCancel={endBendDrag}
            />
          </div>
        )}
        {showLabels && (
        <div
          className="nodrag nopan"
          style={{ position: 'absolute', transform: labelTransform, pointerEvents: 'all', zIndex: 50 }}
        >
          <div
            className={`rounded border bg-white shadow-md dark:bg-gray-900 print:shadow-none ${
              isBundle ? 'px-2.5 py-1.5 max-w-[min(94vw,720px)]' : 'px-2.5 py-1.5 max-w-[min(100vw,280px)]'
            } ${canDragLabel ? 'cursor-grab active:cursor-grabbing' : onNavigateToConnection && !isBundle ? 'cursor-pointer' : ''}`}
            style={{ borderColor: strokeColor, zIndex: 50 + sourceFanIndex }}
            title={labelTitle}
            onClick={handleLabelClick}
            onPointerDown={onLabelPointerDown}
            onPointerMove={onLabelPointerMove}
            onPointerUp={endLabelDrag}
            onPointerCancel={endLabelDrag}
          >
            {isBundle && bundleMembers ? (
              <>
                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 mb-1 dark:border-gray-600">
                  <span className="text-xs font-semibold text-gray-800 dark:text-gray-100">{bundleMembers.length} enlaces</span>
                </div>
                <ul className={`grid gap-1 ${bundleGridColumnCount(bundleMembers.length) === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
                  {bundleMembers.map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={!onNavigateToConnection}
                        onClick={(e) => { e.stopPropagation(); onNavigateToConnection?.(m.id) }}
                        className="w-full rounded border border-gray-200 bg-gray-50 px-1.5 py-1 text-left text-[10px] dark:border-gray-700 dark:bg-gray-800"
                      >
                        <span style={{ color: m.sourceColor }}>{m.sourcePort}</span>
                        {' → '}
                        <span style={{ color: m.targetColor }}>{m.targetPort}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 border-b border-gray-200 pb-1 mb-1 dark:border-gray-600">
                  <span style={{ color: sourceColor }} className="font-mono text-xs font-semibold">{sourcePort}</span>
                  <span className="text-gray-400 text-xs">→</span>
                  <span style={{ color: targetColor }} className="font-mono text-xs font-semibold">{targetPort}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold ${badgeConfig.text} ${badgeConfig.bg}`}>
                    {badgeConfig.icon} {mediumLabel}
                  </span>
                  {d?.portRole && (
                    <span className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {d.portRole === 'trunk' ? 'Trunk' : 'Access'}
                    </span>
                  )}
                  <span className={`size-2 rounded-full ${statusDot}`} />
                </div>
              </>
            )}
          </div>
        </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
