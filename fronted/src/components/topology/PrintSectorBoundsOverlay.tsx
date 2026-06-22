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

const STROKE = 'rgba(234, 88, 12, 0.6)'
const STROKE_FRAME = 'rgba(234, 88, 12, 0.35)'

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
        stroke={STROKE}
        strokeWidth={2}
        strokeDasharray="10 6"
        vectorEffect="non-scaling-stroke"
      />
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
        stroke={STROKE}
        strokeWidth={2}
        strokeDasharray="10 6"
        vectorEffect="non-scaling-stroke"
      />
    )
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
      </svg>
    </ViewportPortal>
  )
}
