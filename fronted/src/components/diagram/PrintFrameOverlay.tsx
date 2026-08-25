import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { useStore, ViewportPortal } from '@xyflow/react'
import type { DiagramPrintFrame } from '../../types'
import type { PaperFormat, PrintOrientation } from '../../utils/pdf/a4Geometry'
import {
  contentOutsideFrame,
  frameWithGrid,
  MAX_DIAGRAM_PAGES,
  nodesCutByPageEdge,
  printFrameRect,
  scalePercentFromMmPerPx,
} from '../../utils/pdf/printFrame'

type PrintFrameOverlayProps = {
  enabled: boolean
  frame: DiagramPrintFrame | null
  orientation: PrintOrientation
  format?: PaperFormat
  locked?: boolean
  readOnly?: boolean
  /** Columna 0-based del sector resaltado (solo visual; selección en el sidebar). */
  highlightedCol?: number
  /** Fila 0-based del sector resaltado (solo visual; selección en el sidebar). */
  highlightedRow?: number
  onFrameChange?: (frame: DiagramPrintFrame) => void
  onFrameChangeEnd?: (frame: DiagramPrintFrame) => void
  onDiagnostics?: (info: { outsideCount: number; cutCount: number }) => void
}

const STROKE_ACTIVE = 'rgba(234, 88, 12, 0.95)'
const FILL_ACTIVE = 'rgba(234, 88, 12, 0.06)'
const STROKE_EXTRA = 'rgba(234, 88, 12, 0.35)'
const STROKE_FRAME = 'rgba(234, 88, 12, 0.55)'
const FILL_OUTSIDE = 'rgba(220, 38, 38, 0.12)'
const STROKE_OUTSIDE = 'rgba(220, 38, 38, 0.75)'
const FILL_CUT = 'rgba(245, 158, 11, 0.12)'
const STROKE_CUT = 'rgba(245, 158, 11, 0.8)'

type DragKind = 'move' | 'cols' | 'rows' | 'corner'

function orientationLabel(orientation: PrintOrientation): string {
  return orientation === 'landscape' ? 'horizontal' : 'vertical'
}

export function PrintFrameOverlay({
  enabled,
  frame,
  orientation,
  format = 'a4',
  locked = false,
  readOnly = false,
  highlightedCol = 0,
  highlightedRow = 0,
  onFrameChange,
  onFrameChangeEnd,
  onDiagnostics,
}: PrintFrameOverlayProps) {
  const nodes = useStore((s) => s.nodes)
  const transform = useStore((s) => s.transform)
  const zoom = transform[2] || 1
  const interactive = Boolean(frame && !locked && !readOnly && onFrameChange)
  const frameRef = useRef(frame)
  frameRef.current = frame
  const dragRef = useRef<{
    kind: DragKind
    startClientX: number
    startClientY: number
    startFrame: DiagramPrintFrame
    pageW: number
    pageH: number
  } | null>(null)

  const rect = useMemo(
    () => (frame ? printFrameRect(frame, format, orientation) : null),
    [frame, format, orientation],
  )

  const outside = useMemo(
    () => (rect ? contentOutsideFrame(nodes, rect) : []),
    [nodes, rect],
  )
  const cut = useMemo(
    () =>
      rect && frame
        ? nodesCutByPageEdge(nodes, rect, frame.cols, frame.rows)
        : [],
    [nodes, rect, frame],
  )

  useEffect(() => {
    onDiagnostics?.({ outsideCount: outside.length, cutCount: cut.length })
  }, [outside.length, cut.length, onDiagnostics])

  if (!enabled || !frame || !rect) return null

  const { x, y, width, height } = rect
  const cols = Math.max(1, frame.cols)
  const rows = Math.max(1, frame.rows)
  const pageW = width / cols
  const pageH = height / rows
  const pages = cols * rows
  const scalePct = scalePercentFromMmPerPx(frame.mmPerPx)
  const activeCol = Math.min(Math.max(0, highlightedCol), cols - 1)
  const activeRow = Math.min(Math.max(0, highlightedRow), rows - 1)

  const verticals: ReactElement[] = []
  for (let i = 1; i < cols; i++) {
    const lx = x + (i / cols) * width
    verticals.push(
      <line
        key={`v-${i}`}
        x1={lx}
        y1={y}
        x2={lx}
        y2={y + height}
        stroke={STROKE_EXTRA}
        strokeWidth={1.5}
        strokeDasharray="8 6"
        vectorEffect="non-scaling-stroke"
      />,
    )
  }

  const horizontals: ReactElement[] = []
  for (let j = 1; j < rows; j++) {
    const ly = y + (j / rows) * height
    horizontals.push(
      <line
        key={`h-${j}`}
        x1={x}
        y1={ly}
        x2={x + width}
        y2={ly}
        stroke={STROKE_EXTRA}
        strokeWidth={1.5}
        strokeDasharray="8 6"
        vectorEffect="non-scaling-stroke"
      />,
    )
  }

  const pageLabels: ReactElement[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pageIndex = r * cols + c + 1
      const isActive = r === activeRow && c === activeCol
      pageLabels.push(
        <text
          key={`label-${pageIndex}`}
          x={x + c * pageW + 8}
          y={y + r * pageH + 18}
          fill={isActive ? STROKE_ACTIVE : STROKE_EXTRA}
          fontSize={isActive ? 13 : 12}
          fontWeight={isActive ? 700 : 400}
          fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          {`Pág. ${pageIndex}`}
        </text>,
      )
    }
  }

  const highlightRects: ReactElement[] = []
  for (const n of outside) {
    const w = Number(n.measured?.width ?? n.width ?? n.style?.width ?? 0)
    const h = Number(n.measured?.height ?? n.height ?? n.style?.height ?? 0)
    highlightRects.push(
      <rect
        key={`out-${n.id}`}
        x={n.position.x}
        y={n.position.y}
        width={w}
        height={h}
        fill={FILL_OUTSIDE}
        stroke={STROKE_OUTSIDE}
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />,
    )
  }
  for (const n of cut) {
    if (outside.some((o) => o.id === n.id)) continue
    const w = Number(n.measured?.width ?? n.width ?? n.style?.width ?? 0)
    const h = Number(n.measured?.height ?? n.height ?? n.style?.height ?? 0)
    highlightRects.push(
      <rect
        key={`cut-${n.id}`}
        x={n.position.x}
        y={n.position.y}
        width={w}
        height={h}
        fill={FILL_CUT}
        stroke={STROKE_CUT}
        strokeWidth={2}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
      />,
    )
  }

  const commitFrame = (next: DiagramPrintFrame, ended: boolean) => {
    onFrameChange?.(next)
    if (ended) onFrameChangeEnd?.(next)
  }

  const onPointerMove = (event: PointerEvent) => {
    const session = dragRef.current
    const start = session?.startFrame
    if (!session || !start || !onFrameChange) return
    const dx = (event.clientX - session.startClientX) / zoom
    const dy = (event.clientY - session.startClientY) / zoom
    if (session.kind === 'move') {
      onFrameChange({ ...start, x: start.x + dx, y: start.y + dy })
      return
    }
    let nextCols = start.cols
    let nextRows = start.rows
    if (session.kind === 'cols' || session.kind === 'corner') {
      nextCols = Math.max(
        1,
        Math.round((session.pageW * start.cols + dx) / Math.max(8, session.pageW)),
      )
    }
    if (session.kind === 'rows' || session.kind === 'corner') {
      nextRows = Math.max(
        1,
        Math.round((session.pageH * start.rows + dy) / Math.max(8, session.pageH)),
      )
    }
    if (nextCols * nextRows > MAX_DIAGRAM_PAGES) {
      if (session.kind === 'cols') nextCols = Math.max(1, Math.floor(MAX_DIAGRAM_PAGES / nextRows))
      else if (session.kind === 'rows') nextRows = Math.max(1, Math.floor(MAX_DIAGRAM_PAGES / nextCols))
      else if (dx >= dy) nextCols = Math.max(1, Math.floor(MAX_DIAGRAM_PAGES / nextRows))
      else nextRows = Math.max(1, Math.floor(MAX_DIAGRAM_PAGES / nextCols))
    }
    onFrameChange(frameWithGrid(start, nextCols, nextRows))
  }

  const onPointerUp = () => {
    const session = dragRef.current
    dragRef.current = null
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    const latest = frameRef.current
    if (session && latest) commitFrame(latest, true)
  }

  const startDrag = (event: ReactPointerEvent, kind: DragKind) => {
    if (!interactive || !frame) return
    event.preventDefault()
    event.stopPropagation()
    dragRef.current = {
      kind,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startFrame: { ...frame },
      pageW,
      pageH,
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  return (
    <ViewportPortal>
      <div
        data-print-bounds-overlay="true"
        className="pointer-events-none"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}
      >
        <svg
          className="pointer-events-none"
          style={{ overflow: 'visible', position: 'absolute', left: 0, top: 0 }}
          aria-hidden
        >
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill="none"
            stroke={STROKE_FRAME}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {verticals}
          {horizontals}
          <rect
            x={x + activeCol * pageW}
            y={y + activeRow * pageH}
            width={pageW}
            height={pageH}
            fill={FILL_ACTIVE}
            stroke={STROKE_ACTIVE}
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
          {highlightRects}
          {pageLabels}
        </svg>

        <div
          className="pointer-events-none absolute"
          style={{ left: x, top: y, width, height }}
        >
          <div
            className="pointer-events-none absolute left-2 top-2 z-20 max-w-[calc(100%-1rem)] rounded-md border border-orange-400/80 bg-slate-950/90 px-2 py-1 text-[11px] font-semibold leading-tight text-orange-100 shadow-md"
            style={{ pointerEvents: 'none' }}
          >
            {`${cols} × ${rows} ${format.toUpperCase()} ${orientationLabel(orientation)} · ${pages} pág${pages === 1 ? '' : 's'} · escala ${scalePct}%`}
            {locked ? ' · bloqueado' : ''}
          </div>

          {interactive ? (
            <>
              <div
                className="nodrag nopan absolute left-0 top-0 z-10 h-7 w-full cursor-move"
                style={{ pointerEvents: 'auto' }}
                title="Arrastrar área de impresión"
                onPointerDown={(e) => startDrag(e, 'move')}
              />
              <div
                className="nodrag nopan absolute top-1/2 right-0 z-10 h-10 w-3 -translate-y-1/2 cursor-ew-resize rounded-sm bg-orange-500/80"
                style={{ pointerEvents: 'auto' }}
                title="Agregar o quitar columnas (páginas)"
                onPointerDown={(e) => startDrag(e, 'cols')}
              />
              <div
                className="nodrag nopan absolute bottom-0 left-1/2 z-10 h-3 w-10 -translate-x-1/2 cursor-ns-resize rounded-sm bg-orange-500/80"
                style={{ pointerEvents: 'auto' }}
                title="Agregar o quitar filas (páginas)"
                onPointerDown={(e) => startDrag(e, 'rows')}
              />
              <div
                className="nodrag nopan absolute bottom-0 right-0 z-10 h-3.5 w-3.5 cursor-nwse-resize rounded-sm bg-orange-600"
                style={{ pointerEvents: 'auto' }}
                title="Cambiar columnas y filas"
                onPointerDown={(e) => startDrag(e, 'corner')}
              />
            </>
          ) : null}
        </div>
      </div>
    </ViewportPortal>
  )
}
