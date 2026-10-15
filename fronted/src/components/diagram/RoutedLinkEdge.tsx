import { memo, useCallback, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeProps,
} from '@xyflow/react'
import { type MediumInfo } from '../../types'
import {
  clampLabelPathT,
  closestPointOnPath,
  defaultLabelPathT,
  pathLabelAnchor,
  pointAtPathT,
  polylineLength,
  roundedOrthogonalPath,
  trimPolylineEnds,
  type DiagramPoint,
} from '../../utils/diagram/orthogonalPath'
import { portCableClearancePx } from '../../utils/diagram/portHitTest'
import { formatLinkCode } from '../../utils/diagram/linkLabel'
import { linkStrokeColor, linkStrokeDasharray } from '../../utils/diagram/linkTypeStyle'
import { DIAGRAM_LINK_REF } from '../../utils/diagram/diagramTypography'
import {
  dragOrthogonalCorner,
  dragOrthogonalSegment,
  insertBendOnSegment,
  listCornerHandles,
  listSegmentHandles,
  reattachOrthogonalEnds,
} from '../../utils/diagram/orthogonalRouteEdit'
import { repairManualRoute } from '../../utils/diagram/routeTransform'

export type RoutedLinkEdgeData = {
  code?: number
  sourcePort: string
  targetPort: string
  sourcePortId?: string | null
  targetPortId?: string | null
  sourceLabel?: string
  targetLabel?: string
  cableTypeId?: string | null
  cableTypeName?: string | null
  linkTypeId?: string | null
  linkTypeName?: string | null
  linkTypeColor?: string | null
  linkTypeLineStyle?: string | null
  medium?: MediumInfo
  connectionType?: 'physical' | 'logical'
  routePoints?: DiagramPoint[]
  /** When true, auto-router must not overwrite the user's path. */
  routeManual?: boolean
  /** Manual route that now crosses another node after a move. */
  routeStale?: boolean
  readOnly?: boolean
  labelOffsetX?: number
  labelOffsetY?: number
  /** Normalized position of the code chip along the polyline (0–1). */
  labelPathT?: number
  vlanLabel?: string
  networkLabel?: string
  [key: string]: unknown
}

export type RoutedLinkEdgeType = Edge<RoutedLinkEdgeData, 'routedLink'>

type DragKind =
  | { type: 'segment'; index: number }
  | { type: 'corner'; index: number }
  | { type: 'label' }

function RoutedLinkEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  selected,
  style,
}: EdgeProps<RoutedLinkEdgeType>) {
  const { setEdges, screenToFlowPosition } = useReactFlow()
  const dragSessionRef = useRef<{ kind: DragKind; basePoints: DiagramPoint[] } | null>(
    null
  )
  const pointsRef = useRef<DiagramPoint[]>([])

  const points = useMemo(() => {
    const rfSource = { x: sourceX, y: sourceY }
    const rfTarget = { x: targetX, y: targetY }
    if (data?.routePoints && data.routePoints.length >= 2) {
      const source = rfSource
      const target = rfTarget
      return data.routeManual
        ? repairManualRoute(data.routePoints, source, target)
        : reattachOrthogonalEnds(data.routePoints, source, target)
    }
    const source = rfSource
    const target = rfTarget
    const midY = (sourceY + targetY) / 2
    return [
      source,
      { x: sourceX, y: midY },
      { x: targetX, y: midY },
      target,
    ]
  }, [data?.routePoints, data?.routeManual, sourceX, sourceY, targetX, targetY])

  pointsRef.current = points

  const path = useMemo(() => roundedOrthogonalPath(points, 8), [points])
  const zoom = useStore((s) => s.transform[2] || 1)
  const interactionPath = useMemo(() => {
    const trimmed = trimPolylineEnds(points, portCableClearancePx(zoom))
    if (polylineLength(trimmed) + 8 >= polylineLength(points)) return ''
    return roundedOrthogonalPath(trimmed, 8)
  }, [points, zoom])

  const labelT = useMemo(() => {
    if (data?.labelPathT != null && Number.isFinite(data.labelPathT)) {
      return Math.min(1, Math.max(0, data.labelPathT))
    }
    const anchor = pathLabelAnchor(points)
    if (data?.labelOffsetX || data?.labelOffsetY) {
      return closestPointOnPath(points, {
        x: anchor.x + (data.labelOffsetX ?? 0),
        y: anchor.y + (data.labelOffsetY ?? 0),
      }).t
    }
    return defaultLabelPathT(points)
  }, [data?.labelPathT, data?.labelOffsetX, data?.labelOffsetY, points])

  const labelPos = useMemo(() => pointAtPathT(points, labelT), [points, labelT])

  const sourceText = data?.sourceLabel || data?.sourcePort || null
  const targetText = data?.targetLabel || data?.targetPort || null
  const fullLabel =
    sourceText && targetText
      ? `${sourceText} A ${targetText}`
      : sourceText || targetText || null
  const codeLabel = data?.code != null ? formatLinkCode(data.code) : null
  /** En el canvas solo el código (E1…); el tipo de cable vive en la tabla de referencia. */
  const label = codeLabel ?? fullLabel

  const stale = data?.routeStale === true
  const stroke = linkStrokeColor(data?.linkTypeColor, stale)
  const editable = Boolean(selected && !data?.readOnly)
  const canDragLabel = !data?.readOnly
  const segmentHandles = useMemo(
    () => (editable ? listSegmentHandles(points) : []),
    [editable, points]
  )
  const cornerHandles = useMemo(
    () => (editable ? listCornerHandles(points) : []),
    [editable, points]
  )

  const commitPoints = useCallback(
    (next: DiagramPoint[]) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id
            ? {
                ...e,
                data: {
                  ...e.data,
                  routePoints: next,
                  routeManual: true,
                },
              }
            : e
        )
      )
    },
    [id, setEdges]
  )

  const commitLabelT = useCallback(
    (t: number) => {
      const pts = pointsRef.current
      const clamped = clampLabelPathT(t, polylineLength(pts))
      const pos = pointAtPathT(pts, clamped)
      const anchor = pathLabelAnchor(pts)
      setEdges((eds) =>
        eds.map((e) =>
          e.id === id
            ? {
                ...e,
                data: {
                  ...e.data,
                  labelPathT: clamped,
                  labelOffsetX: pos.x - anchor.x,
                  labelOffsetY: pos.y - anchor.y,
                },
              }
            : e
        )
      )
    },
    [id, setEdges]
  )

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      const session = dragSessionRef.current
      if (!session) return
      const cursor = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      if (session.kind.type === 'label') {
        commitLabelT(closestPointOnPath(pointsRef.current, cursor).t)
        return
      }
      const next =
        session.kind.type === 'segment'
          ? dragOrthogonalSegment(session.basePoints, session.kind.index, cursor)
          : dragOrthogonalCorner(session.basePoints, session.kind.index, cursor)
      commitPoints(next)
    },
    [commitLabelT, commitPoints, screenToFlowPosition]
  )

  const onPointerUp = useCallback(() => {
    dragSessionRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }, [onPointerMove])

  const startDrag = useCallback(
    (event: ReactPointerEvent, kind: DragKind) => {
      event.preventDefault()
      event.stopPropagation()
      dragSessionRef.current = {
        kind,
        basePoints: pointsRef.current.map((p) => ({ ...p })),
      }
      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
    },
    [onPointerMove, onPointerUp]
  )

  const onSegmentDoubleClick = useCallback(
    (event: ReactPointerEvent, segmentIndex: number) => {
      event.preventDefault()
      event.stopPropagation()
      const cursor = screenToFlowPosition({ x: event.clientX, y: event.clientY })
      commitPoints(insertBendOnSegment(pointsRef.current, segmentIndex, cursor))
    },
    [commitPoints, screenToFlowPosition]
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        interactionWidth={interactionPath ? 0 : 24}
        style={{
          ...style,
          stroke: stroke,
          strokeDasharray: linkStrokeDasharray(data?.linkTypeLineStyle, stale),
          strokeWidth: selected ? 4 : stale ? 2.5 : 2,
          pointerEvents: interactionPath ? 'none' : undefined,
          filter: selected
            ? 'drop-shadow(0 0 5px rgba(56, 189, 248, 0.95))'
            : stale
              ? 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.7))'
              : undefined,
        }}
      />
      {interactionPath ? (
        <path
          d={interactionPath}
          fill="none"
          stroke="#000"
          strokeOpacity={0}
          strokeWidth={24}
          className="react-flow__edge-interaction"
        />
      ) : null}
      {label ? (
        <EdgeLabelRenderer>
          <div
            className={`nodrag nopan absolute z-[5000] select-none rounded-md border px-2 py-1 ${DIAGRAM_LINK_REF} shadow-lg ${
              stale
                ? 'border-amber-400/90 bg-amber-950/95 text-amber-50 ring-1 ring-amber-500/40'
                : 'bg-slate-950/95 text-sky-50 dark:border-sky-600/80'
            } ${canDragLabel ? 'cursor-grab hover:ring-2 hover:ring-sky-400/70 active:cursor-grabbing' : ''}`}
            style={{
              transform: `translate(-50%, -50%) translate(${labelPos.x}px, ${labelPos.y}px)`,
              pointerEvents: 'auto',
              touchAction: 'none',
              borderColor: stale ? undefined : stroke,
              boxShadow: stale ? undefined : `0 0 0 1px ${stroke}`,
            }}
            title={
              stale
                ? `${fullLabel ?? label} · ruta desactualizada (cruza un equipo)`
                : canDragLabel
                  ? `${fullLabel ?? label} · arrastrar a lo largo del enlace`
                  : (fullLabel ?? label)
            }
            onPointerDown={
              canDragLabel ? (e) => startDrag(e, { type: 'label' }) : undefined
            }
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
      {editable ? (
        <EdgeLabelRenderer>
          {segmentHandles.map((h) => (
            <div
              key={`seg-${id}-${h.segmentIndex}`}
              className="nodrag nopan absolute z-[6000] h-3 w-3 rounded-sm border-2 border-sky-300 bg-slate-950 shadow-md ring-1 ring-sky-500/40"
              style={{
                transform: `translate(-50%, -50%) translate(${h.point.x}px, ${h.point.y}px)`,
                cursor: h.orientation === 'h' ? 'ns-resize' : 'ew-resize',
                pointerEvents: 'all',
              }}
              title="Arrastrar tramo · doble clic para añadir codo"
              onPointerDown={(e) => startDrag(e, { type: 'segment', index: h.segmentIndex })}
              onDoubleClick={(e) => onSegmentDoubleClick(e, h.segmentIndex)}
            />
          ))}
          {cornerHandles.map((h) => (
            <div
              key={`corner-${id}-${h.pointIndex}`}
              className="nodrag nopan absolute z-[6001] h-3.5 w-3.5 border-2 border-amber-300 bg-slate-950 shadow-md ring-1 ring-amber-500/40"
              style={{
                transform: `translate(-50%, -50%) translate(${h.point.x}px, ${h.point.y}px) rotate(45deg)`,
                cursor: 'move',
                pointerEvents: 'all',
              }}
              title="Arrastrar esquina"
              onPointerDown={(e) => startDrag(e, { type: 'corner', index: h.pointIndex })}
            />
          ))}
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

export const RoutedLinkEdge = memo(RoutedLinkEdgeComponent)
