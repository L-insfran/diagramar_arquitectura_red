import type { PrintOrientation } from './a4Geometry'
import { getA4Geometry } from './a4Geometry'

/** mm por píxel de flujo objetivo (1U = 44 px → 4.4 mm). */
export const TARGET_MM_PER_FLOW_PX = 0.10
/** Piso de legibilidad; por debajo se recorta en más sectores. */
export const MIN_MM_PER_FLOW_PX = 0.05
/** Tope de páginas de diagrama (sin contar portada ni tablas). */
export const MAX_DIAGRAM_PAGES = 12
/** DPI base de captura CSS → px. */
export const EXPORT_DPI = 160
/** DPI mínimo si la imagen sería demasiado grande. */
export const MIN_EXPORT_DPI = 110
/** Límite aproximado de píxeles totales del PNG. */
export const MAX_EXPORT_PIXELS = 28_000_000
/** Solape entre sectores vecinos (mm). */
export const TILE_OVERLAP_MM = 4
/** Padding relativo al calcular viewport de captura. */
export const CAPTURE_FIT_PADDING = 0.04
export const CAPTURE_FIT_MIN_ZOOM = 0.02
export const CAPTURE_FIT_MAX_ZOOM = 4

export type FlowBounds = { x: number; y: number; width: number; height: number }

export type DiagramPagePlan = {
  cols: number
  rows: number
  mmPerPx: number
  /** Ancho CSS del PNG de captura (px). */
  cssW: number
  /** Alto CSS del PNG de captura (px). */
  cssH: number
  pixelRatio: number
  /** Ancho del PNG final (px). */
  imgW: number
  /** Alto del PNG final (px). */
  imgH: number
  /** mm por píxel del PNG final (para solape). */
  mmPerImgPx: number
}

function mmToCssPx(mm: number, dpi: number): number {
  return (mm / 25.4) * dpi
}

/**
 * Planifica la grilla de sectores A4 y las dimensiones de captura
 * a partir de los bounds reales del diagrama (coords de flujo).
 */
export function planDiagramPages(
  bounds: FlowBounds,
  orientation: PrintOrientation,
): DiagramPagePlan {
  const geom = getA4Geometry(orientation)
  const bw = Math.max(1, bounds.width)
  const bh = Math.max(1, bounds.height)

  let mmPerPx = TARGET_MM_PER_FLOW_PX
  let cols = Math.max(1, Math.ceil((bw * mmPerPx) / geom.sector.w))
  let rows = Math.max(1, Math.ceil((bh * mmPerPx) / geom.sector.h))

  // Bajar escala hasta caber en MAX_DIAGRAM_PAGES (o hasta el piso).
  while (cols * rows > MAX_DIAGRAM_PAGES && mmPerPx > MIN_MM_PER_FLOW_PX + 1e-6) {
    mmPerPx = Math.max(MIN_MM_PER_FLOW_PX, mmPerPx * 0.85)
    cols = Math.max(1, Math.ceil((bw * mmPerPx) / geom.sector.w))
    rows = Math.max(1, Math.ceil((bh * mmPerPx) / geom.sector.h))
  }

  // Si aún supera el tope al piso, forzar grilla acotada.
  if (cols * rows > MAX_DIAGRAM_PAGES) {
    const aspect = bw / bh
    const pageAspect = geom.sector.w / geom.sector.h
    let bestCols = 1
    let bestRows = 1
    let bestDiff = Infinity
    for (let c = 1; c <= MAX_DIAGRAM_PAGES; c++) {
      const r = Math.ceil(MAX_DIAGRAM_PAGES / c)
      if (c * r > MAX_DIAGRAM_PAGES) continue
      const gridAspect = (c * geom.sector.w) / (r * geom.sector.h)
      const diff = Math.abs(gridAspect - aspect / pageAspect)
      if (diff < bestDiff) {
        bestDiff = diff
        bestCols = c
        bestRows = r
      }
    }
    cols = bestCols
    rows = bestRows
    mmPerPx = Math.min(
      TARGET_MM_PER_FLOW_PX,
      Math.min((cols * geom.sector.w) / bw, (rows * geom.sector.h) / bh),
    )
    mmPerPx = Math.max(MIN_MM_PER_FLOW_PX * 0.5, mmPerPx)
  }

  // El PNG cubre exactamente la grilla de sectores (mismo aspect → sin bandas).
  const totalMmW = cols * geom.sector.w
  const totalMmH = rows * geom.sector.h

  let dpi = EXPORT_DPI
  let cssW = Math.round(mmToCssPx(totalMmW, dpi))
  let cssH = Math.round(mmToCssPx(totalMmH, dpi))
  let pixelRatio = 1

  // Ajustar pixelRatio / DPI para no superar el límite de memoria.
  const tryPixels = (w: number, h: number, pr: number) => w * h * pr * pr
  while (tryPixels(cssW, cssH, pixelRatio) > MAX_EXPORT_PIXELS && pixelRatio > 1) {
    pixelRatio = 1
  }
  while (tryPixels(cssW, cssH, 1) > MAX_EXPORT_PIXELS && dpi > MIN_EXPORT_DPI) {
    dpi = Math.max(MIN_EXPORT_DPI, dpi - 10)
    cssW = Math.round(mmToCssPx(totalMmW, dpi))
    cssH = Math.round(mmToCssPx(totalMmH, dpi))
  }
  // Subir pixelRatio si cabe.
  if (tryPixels(cssW, cssH, 2) <= MAX_EXPORT_PIXELS) pixelRatio = 2
  if (tryPixels(cssW, cssH, 3) <= MAX_EXPORT_PIXELS && dpi >= 140) pixelRatio = 3

  const imgW = Math.round(cssW * pixelRatio)
  const imgH = Math.round(cssH * pixelRatio)
  const mmPerImgPx = totalMmW / imgW

  return {
    cols,
    rows,
    mmPerPx,
    cssW,
    cssH,
    pixelRatio,
    imgW,
    imgH,
    mmPerImgPx,
  }
}

/**
 * Bounds de captura en coords de flujo: exactamente el área que cubre la grilla
 * a la escala planificada (puede ser mayor que el contenido si hay padding).
 */
export function captureRectFromPlan(
  bounds: FlowBounds,
  plan: DiagramPagePlan,
  orientation: PrintOrientation,
): { x: number; y: number; width: number; height: number } {
  const geom = getA4Geometry(orientation)
  const totalMmW = plan.cols * geom.sector.w
  const totalMmH = plan.rows * geom.sector.h
  const width = totalMmW / plan.mmPerPx
  const height = totalMmH / plan.mmPerPx
  const x = bounds.x - (width - bounds.width) / 2
  const y = bounds.y - (height - bounds.height) / 2
  return { x, y, width, height }
}
