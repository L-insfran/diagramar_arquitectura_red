import { useMemo, type ReactElement } from 'react'
import { useStore, ViewportPortal } from '@xyflow/react'
import {
  computeExportCaptureRect,
  computeTileGrid,
  getA4DiagramUsableMm,
  getExportCapturePixelSize,
  type PrintOrientation,
} from '../../utils/printDiagramSectorGrid'

type PrintSectorBoundsOverlayProps = {
  enabled: boolean
  orientation: PrintOrientation
}

const STROKE_PAGE1 = 'rgba(234, 88, 12, 0.95)'
const FILL_PAGE1 = 'rgba(234, 88, 12, 0.06)'
const STROKE_EXTRA = 'rgba(234, 88, 12, 0.35)'
const STROKE_FRAME = 'rgba(234, 88, 12, 0.45)'

export function PrintSectorBoundsOverlay({ enabled, orientation }: PrintSectorBoundsOverlayProps) {
  const nodes = useStore((s) => s.nodes)

  const data = useMemo(() => {
    const rect = computeExportCaptureRect(nodes, orientation)
    if (!rect) return null
    const { imgW, imgH } = getExportCapturePixelSize(nodes.length, orientation)
    const { usableW, usableH } = getA4DiagramUsableMm(orientation)
    const { cols, rows } = computeTileGrid(imgW, imgH, usableW, usableH)
    return { rect, cols, rows }
  }, [nodes, orientation])

  if (!enabled || !data) return null

  const { rect, cols, rows } = data
  const { x, y, width, height } = rect
  const pageW = width / cols
  const pageH = height / rows

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

  const extraLabels: ReactElement[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === 0 && c === 0) continue
      const pageIndex = r * cols + c + 1
      extraLabels.push(
        <text
          key={`label-${pageIndex}`}
          x={x + c * pageW + 8}
          y={y + r * pageH + 18}
          fill={STROKE_EXTRA}
          fontSize={12}
          fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          {`Pág. ${pageIndex}`}
        </text>,
      )
    }
  }

  return (
    <ViewportPortal>
      <svg className="pointer-events-none" style={{ overflow: 'visible' }} aria-hidden>
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
        {/* Página 1 destacada */}
        <rect
          x={x}
          y={y}
          width={pageW}
          height={pageH}
          fill={FILL_PAGE1}
          stroke={STROKE_PAGE1}
          strokeWidth={3}
          vectorEffect="non-scaling-stroke"
        />
        <text
          x={x + 10}
          y={y + 22}
          fill={STROKE_PAGE1}
          fontSize={14}
          fontWeight={700}
          fontFamily="system-ui, sans-serif"
          style={{ pointerEvents: 'none' }}
        >
          Página 1 (A4)
        </text>
        {extraLabels}
      </svg>
    </ViewportPortal>
  )
}
