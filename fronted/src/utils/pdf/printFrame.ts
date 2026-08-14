import { type Node } from '@xyflow/react'
import type { DiagramPrintFrame } from '../../types'
import {
  getPaperGeometry,
  type PaperFormat,
  type PrintOrientation,
} from './a4Geometry'
import {
  captureRectFromPlan,
  MAX_DIAGRAM_PAGES,
  MIN_MM_PER_FLOW_PX,
  planDiagramPages,
  planPagesForGrid,
  TARGET_MM_PER_FLOW_PX,
  type DiagramPagePlan,
  type FlowBounds,
} from './diagramScale'

const MM_PER_PX_MIN = 0.02
const MM_PER_PX_MAX = 0.4

export type PrintFrameRect = {
  x: number
  y: number
  width: number
  height: number
}

function clampMmPerPx(value: number): number {
  if (!Number.isFinite(value)) return TARGET_MM_PER_FLOW_PX
  return Math.min(MM_PER_PX_MAX, Math.max(MM_PER_PX_MIN, value))
}

function clampGrid(cols: number, rows: number): { cols: number; rows: number } {
  let c = Math.max(1, Math.min(24, Math.round(cols)))
  let r = Math.max(1, Math.min(24, Math.round(rows)))
  if (c * r > MAX_DIAGRAM_PAGES) {
    if (c >= r) c = Math.max(1, Math.floor(MAX_DIAGRAM_PAGES / r))
    else r = Math.max(1, Math.floor(MAX_DIAGRAM_PAGES / c))
  }
  return { cols: Math.max(1, c), rows: Math.max(1, r) }
}

export function normalizePrintFrame(frame: DiagramPrintFrame): DiagramPrintFrame {
  const grid = clampGrid(frame.cols, frame.rows)
  return {
    x: Number.isFinite(frame.x) ? frame.x : 0,
    y: Number.isFinite(frame.y) ? frame.y : 0,
    cols: grid.cols,
    rows: grid.rows,
    mmPerPx: clampMmPerPx(frame.mmPerPx),
  }
}

export function parsePrintFrame(value: unknown): DiagramPrintFrame | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Partial<DiagramPrintFrame>
  if (
    typeof v.x !== 'number' ||
    typeof v.y !== 'number' ||
    typeof v.cols !== 'number' ||
    typeof v.rows !== 'number' ||
    typeof v.mmPerPx !== 'number'
  ) {
    return null
  }
  return normalizePrintFrame({
    x: v.x,
    y: v.y,
    cols: v.cols,
    rows: v.rows,
    mmPerPx: v.mmPerPx,
  })
}

export function printFrameRect(
  frame: DiagramPrintFrame,
  format: PaperFormat,
  orientation: PrintOrientation,
): PrintFrameRect {
  const geom = getPaperGeometry(format, orientation)
  const normalized = normalizePrintFrame(frame)
  return {
    x: normalized.x,
    y: normalized.y,
    width: (normalized.cols * geom.sector.w) / normalized.mmPerPx,
    height: (normalized.rows * geom.sector.h) / normalized.mmPerPx,
  }
}

export function planFromFrame(
  frame: DiagramPrintFrame,
  format: PaperFormat,
  orientation: PrintOrientation,
): { plan: DiagramPagePlan; bounds: FlowBounds } {
  const geom = getPaperGeometry(format, orientation)
  const normalized = normalizePrintFrame(frame)
  const plan = planPagesForGrid(
    { cols: normalized.cols, rows: normalized.rows, mmPerPx: normalized.mmPerPx },
    geom,
  )
  const bounds = printFrameRect(normalized, format, orientation)
  return { plan, bounds }
}

/** Replica el plan automático actual (bbox centrado) → marco inicial. */
export function frameFromBounds(
  bounds: FlowBounds,
  format: PaperFormat,
  orientation: PrintOrientation,
): DiagramPrintFrame {
  const plan = planDiagramPages(bounds, orientation, format)
  const rect = captureRectFromPlan(bounds, plan, orientation, format)
  return normalizePrintFrame({
    x: rect.x,
    y: rect.y,
    cols: plan.cols,
    rows: plan.rows,
    mmPerPx: plan.mmPerPx,
  })
}

/**
 * Ajusta solo la escala para que el contenido entre en la grilla actual.
 * Conserva cols/rows y recentra el marco sobre su centro previo.
 */
export function fitContentIntoFrame(
  bounds: FlowBounds,
  frame: DiagramPrintFrame,
  format: PaperFormat,
  orientation: PrintOrientation,
  padding = 0.04,
): DiagramPrintFrame {
  const geom = getPaperGeometry(format, orientation)
  const normalized = normalizePrintFrame(frame)
  const bw = Math.max(1, bounds.width) * (1 + padding * 2)
  const bh = Math.max(1, bounds.height) * (1 + padding * 2)
  const mmPerPx = clampMmPerPx(
    Math.min(
      (normalized.cols * geom.sector.w) / bw,
      (normalized.rows * geom.sector.h) / bh,
    ),
  )
  const oldRect = printFrameRect(normalized, format, orientation)
  const next = normalizePrintFrame({ ...normalized, mmPerPx })
  const newRect = printFrameRect(next, format, orientation)
  return {
    ...next,
    x: normalized.x + (oldRect.width - newRect.width) / 2,
    y: normalized.y + (oldRect.height - newRect.height) / 2,
  }
}

export function centerFrameOnBounds(
  bounds: FlowBounds,
  frame: DiagramPrintFrame,
  format: PaperFormat,
  orientation: PrintOrientation,
): DiagramPrintFrame {
  const rect = printFrameRect(frame, format, orientation)
  return normalizePrintFrame({
    ...frame,
    x: bounds.x + (bounds.width - rect.width) / 2,
    y: bounds.y + (bounds.height - rect.height) / 2,
  })
}

export function scalePercentFromMmPerPx(mmPerPx: number): number {
  return Math.round((clampMmPerPx(mmPerPx) / TARGET_MM_PER_FLOW_PX) * 100)
}

export function mmPerPxFromScalePercent(percent: number): number {
  return clampMmPerPx((percent / 100) * TARGET_MM_PER_FLOW_PX)
}

/** Cambia mmPerPx manteniendo el centro del marco. */
export function frameWithScale(
  frame: DiagramPrintFrame,
  mmPerPx: number,
  format: PaperFormat,
  orientation: PrintOrientation,
): DiagramPrintFrame {
  const normalized = normalizePrintFrame(frame)
  const nextMm = clampMmPerPx(mmPerPx)
  if (Math.abs(nextMm - normalized.mmPerPx) < 1e-9) return normalized
  const oldRect = printFrameRect(normalized, format, orientation)
  const next = normalizePrintFrame({ ...normalized, mmPerPx: nextMm })
  const newRect = printFrameRect(next, format, orientation)
  return {
    ...next,
    x: normalized.x + (oldRect.width - newRect.width) / 2,
    y: normalized.y + (oldRect.height - newRect.height) / 2,
  }
}

export function frameWithGrid(
  frame: DiagramPrintFrame,
  cols: number,
  rows: number,
): DiagramPrintFrame {
  return normalizePrintFrame({ ...frame, cols, rows })
}

type NodeRect = { x: number; y: number; width: number; height: number }

function topLevelNodeRect(node: Node): NodeRect | null {
  if (node.hidden || node.parentId) return null
  const width = Number(node.measured?.width ?? node.width ?? node.style?.width ?? 0)
  const height = Number(node.measured?.height ?? node.height ?? node.style?.height ?? 0)
  if (!(width > 0) || !(height > 0)) return null
  return { x: node.position.x, y: node.position.y, width, height }
}

function rectsOverlap(a: NodeRect, b: PrintFrameRect, pad = 0.5): boolean {
  return (
    a.x + a.width > b.x + pad &&
    a.x < b.x + b.width - pad &&
    a.y + a.height > b.y + pad &&
    a.y < b.y + b.height - pad
  )
}

function rectFullyInside(a: NodeRect, b: PrintFrameRect, pad = 0.5): boolean {
  return (
    a.x >= b.x - pad &&
    a.y >= b.y - pad &&
    a.x + a.width <= b.x + b.width + pad &&
    a.y + a.height <= b.y + b.height + pad
  )
}

export function contentOutsideFrame(nodes: Node[], rect: PrintFrameRect): Node[] {
  return nodes.filter((n) => {
    const r = topLevelNodeRect(n)
    if (!r) return false
    return !rectFullyInside(r, rect)
  })
}

export function nodesCutByPageEdge(
  nodes: Node[],
  rect: PrintFrameRect,
  cols: number,
  rows: number,
): Node[] {
  if (cols <= 1 && rows <= 1) return []
  const pageW = rect.width / Math.max(1, cols)
  const pageH = rect.height / Math.max(1, rows)
  const eps = 3
  return nodes.filter((n) => {
    const r = topLevelNodeRect(n)
    if (!r || !rectsOverlap(r, rect, 0)) return false
    for (let c = 1; c < cols; c++) {
      const lx = rect.x + c * pageW
      if (r.x + eps < lx && r.x + r.width - eps > lx) return true
    }
    for (let row = 1; row < rows; row++) {
      const ly = rect.y + row * pageH
      if (r.y + eps < ly && r.y + r.height - eps > ly) return true
    }
    return false
  })
}

export { MIN_MM_PER_FLOW_PX, TARGET_MM_PER_FLOW_PX, MAX_DIAGRAM_PAGES }
