import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react'
import {
  getA4DiagramUsableMm,
  getA4Geometry,
  MARGIN,
  HEADER_H,
  FOOTER_H,
  LEGEND_H,
  SECTOR_HEADER_H,
  type PrintOrientation,
} from './pdf/a4Geometry'
import {
  captureRectFromPlan,
  CAPTURE_FIT_MAX_ZOOM,
  CAPTURE_FIT_MIN_ZOOM,
  CAPTURE_FIT_PADDING,
  planDiagramPages,
  type DiagramPagePlan,
} from './pdf/diagramScale'

export type { PrintOrientation }
export {
  MARGIN,
  HEADER_H,
  FOOTER_H,
  LEGEND_H,
  SECTOR_HEADER_H,
  getA4DiagramUsableMm,
  getA4Geometry,
}
export {
  planDiagramPages,
  captureRectFromPlan,
  CAPTURE_FIT_PADDING,
  CAPTURE_FIT_MIN_ZOOM,
  CAPTURE_FIT_MAX_ZOOM,
  TARGET_MM_PER_FLOW_PX,
  MIN_MM_PER_FLOW_PX,
  TILE_OVERLAP_MM,
  type DiagramPagePlan,
  type FlowBounds,
} from './pdf/diagramScale'

/** @deprecated Prefer CAPTURE_FIT_*; kept for callers that still import these names. */
export const EXPORT_FIT_PADDING = CAPTURE_FIT_PADDING
export const EXPORT_FIT_MAX_ZOOM = CAPTURE_FIT_MAX_ZOOM
export const EXPORT_FIT_MIN_ZOOM = CAPTURE_FIT_MIN_ZOOM

/**
 * Nodos de nivel superior visibles (racks/áreas/sueltos).
 * Los hijos montados ya entran en el bbox del rack padre.
 */
export function getTopLevelVisibleNodes(nodes: Node[]): Node[] {
  return nodes.filter((n) => !n.hidden && !n.parentId)
}

/**
 * Plan de páginas a partir de los nodos actuales del canvas.
 * Devuelve `null` si no hay nodos medidos.
 */
export function planFromNodes(
  nodes: Node[],
  orientation: PrintOrientation,
): { plan: DiagramPagePlan; bounds: { x: number; y: number; width: number; height: number } } | null {
  const top = getTopLevelVisibleNodes(nodes)
  if (top.length === 0) return null
  const bounds = getNodesBounds(top)
  if (!(bounds.width > 0) || !(bounds.height > 0)) return null
  const plan = planDiagramPages(bounds, orientation)
  return { plan, bounds }
}

/**
 * @deprecated Heurística por cantidad de nodos. Preferir `planFromNodes`.
 * Mantiene compatibilidad: dimensiones CSS equivalentes al plan con un bounds sintético.
 */
export function getExportShellCssDimensions(
  nodeCount: number,
  orientation: PrintOrientation = 'landscape',
): { w: number; h: number } {
  // Bounds sintético proporcional a la cantidad de nodos (solo fallback legacy).
  const longSide = Math.min(6400, Math.max(1920, 1280 + nodeCount * 56))
  const shortSide = Math.min(4800, Math.max(1100, 900 + nodeCount * 42))
  const w = orientation === 'landscape' ? longSide : shortSide
  const h = orientation === 'landscape' ? shortSide : longSide
  const plan = planDiagramPages({ x: 0, y: 0, width: w, height: h }, orientation)
  return { w: plan.cssW, h: plan.cssH }
}

/**
 * Dimensiones en píxeles de la captura PNG según el plan real de nodos
 * (si se pasa `nodes`) o una heurística por cantidad.
 */
export function getExportCapturePixelSize(
  nodeCountOrNodes: number | Node[],
  orientation: PrintOrientation = 'landscape',
): { imgW: number; imgH: number; cols?: number; rows?: number } {
  if (Array.isArray(nodeCountOrNodes)) {
    const planned = planFromNodes(nodeCountOrNodes, orientation)
    if (planned) {
      return {
        imgW: planned.plan.imgW,
        imgH: planned.plan.imgH,
        cols: planned.plan.cols,
        rows: planned.plan.rows,
      }
    }
    return { imgW: 1, imgH: 1, cols: 1, rows: 1 }
  }
  const { w, h } = getExportShellCssDimensions(nodeCountOrNodes, orientation)
  return { imgW: w, imgH: h }
}

/**
 * Fallback de grilla (scoring) — preferir `planDiagramPages` con bounds reales.
 * Se mantiene para callers que solo tienen dimensiones de imagen.
 */
export function computeTileGrid(
  imgW: number,
  imgH: number,
  usableW: number,
  usableH: number,
): { cols: number; rows: number } {
  const minReadablePx = 480
  const imgMin = Math.min(imgW, imgH)
  const imgMax = Math.max(imgW, imgH)

  let bestCols = 1
  let bestRows = 1
  let bestScore = 0

  for (let c = 1; c <= 8; c++) {
    for (let r = 1; r <= 8; r++) {
      const tileW = imgW / c
      const tileH = imgH / r
      const tileAspect = tileW / tileH
      const pageAspect = usableW / usableH
      const aspectFit = 1 - Math.abs(tileAspect - pageAspect) / Math.max(tileAspect, pageAspect)

      const tileMinDim = Math.min(tileW, tileH)
      if (tileMinDim < minReadablePx && c * r > 1) continue

      const fillW = tileAspect > pageAspect ? usableW : usableH * tileAspect
      const fillH = tileAspect > pageAspect ? usableW / tileAspect : usableH
      const fillRatio = (fillW * fillH) / (usableW * usableH)

      const pages = c * r
      const pagePenalty = pages > 12 ? 0.55 : pages > 9 ? 0.72 : pages > 6 ? 0.88 : 1
      let score = fillRatio * aspectFit * pagePenalty
      if (imgMax > 2600 && pages > 1) score *= 1.08
      if (imgMin > 2200 && pages === 1 && c === 1 && r === 1) score *= 0.82

      if (score > bestScore) {
        bestScore = score
        bestCols = c
        bestRows = r
      }
    }
  }

  if (bestCols === 1 && bestRows === 1 && imgMin > 2400) {
    return imgW >= imgH ? { cols: 2, rows: 1 } : { cols: 1, rows: 2 }
  }

  return { cols: bestCols, rows: bestRows }
}

/**
 * Rectángulo (en coordenadas de flujo) que la exportación PDF capturará,
 * derivado del mismo `planDiagramPages` que usa la exportación real.
 */
export function computeExportCaptureRect(
  nodes: Node[],
  orientation: PrintOrientation = 'landscape',
): { x: number; y: number; width: number; height: number; cols: number; rows: number } | null {
  const planned = planFromNodes(nodes, orientation)
  if (!planned) return null
  const rect = captureRectFromPlan(planned.bounds, planned.plan, orientation)
  return { ...rect, cols: planned.plan.cols, rows: planned.plan.rows }
}

/**
 * Viewport (translate + scale) que `toPng` aplicará sobre el viewport de React Flow
 * para capturar exactamente el plan.
 */
export function getCaptureViewport(
  bounds: { x: number; y: number; width: number; height: number },
  cssW: number,
  cssH: number,
) {
  return getViewportForBounds(
    bounds,
    cssW,
    cssH,
    CAPTURE_FIT_MIN_ZOOM,
    CAPTURE_FIT_MAX_ZOOM,
    CAPTURE_FIT_PADDING,
  )
}
