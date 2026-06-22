import { jsPDF } from 'jspdf'
import { getNodesBounds, getViewportForBounds, type Node } from '@xyflow/react'

/** Orientación de impresión / exportación PDF. */
export type PrintOrientation = 'landscape' | 'portrait'

/** Márgenes y cabeceras (mm) alineados con la exportación PDF. */
export const MARGIN = 12
export const HEADER_H = 42
export const FOOTER_H = 16
export const LEGEND_H = 12

const cachedA4Usable: Partial<Record<PrintOrientation, { usableW: number; usableH: number }>> = {}

/**
 * Área útil (mm) de la página de portada del PDF para encajar la vista general del diagrama,
 * misma fórmula que `exportTopologyPdf`.
 */
export function getA4DiagramUsableMm(orientation: PrintOrientation): { usableW: number; usableH: number } {
  const cached = cachedA4Usable[orientation]
  if (cached) return cached
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const value = {
    usableW: pageW - MARGIN * 2,
    usableH: pageH - HEADER_H - FOOTER_H - LEGEND_H - 4,
  }
  cachedA4Usable[orientation] = value
  return value
}

/**
 * Mismos parámetros de fitView que `prepareExportCapture` usa antes de capturar el PNG
 * (`fitView({ padding: 0.08, maxZoom: 4 })`). `minZoom` replica el `<ReactFlow minZoom=0.15>`.
 */
export const EXPORT_FIT_PADDING = 0.08
export const EXPORT_FIT_MAX_ZOOM = 4
export const EXPORT_FIT_MIN_ZOOM = 0.15

/**
 * Mismo tamaño CSS de lienzo que `prepareExportCapture` aplica antes de capturar.
 * Para orientación retrato se invierten ancho/alto para que el aspect ratio coincida con A4 vertical.
 */
export function getExportShellCssDimensions(
  nodeCount: number,
  orientation: PrintOrientation = 'landscape'
): { w: number; h: number } {
  const longSide = Math.min(6400, Math.max(1920, 1280 + nodeCount * 56))
  const shortSide = Math.min(4800, Math.max(1100, 900 + nodeCount * 42))
  return orientation === 'landscape'
    ? { w: longSide, h: shortSide }
    : { w: shortSide, h: longSide }
}

/**
 * Dimensiones en píxeles de la captura PNG de exportación (heurística `html-to-image`
 * alineada con `exportTopologyPdf` cuando el lienzo tiene el tamaño de exportación).
 */
export function getExportCapturePixelSize(
  nodeCount: number,
  orientation: PrintOrientation = 'landscape'
): { imgW: number; imgH: number } {
  const { w, h } = getExportShellCssDimensions(nodeCount, orientation)
  const approxCssPixels = Math.max(1, w * h)
  const pixelRatio = approxCssPixels * 9 > 28_000_000 ? 2 : 3
  return {
    imgW: Math.round(w * pixelRatio),
    imgH: Math.round(h * pixelRatio),
  }
}

export function computeTileGrid(
  imgW: number,
  imgH: number,
  usableW: number,
  usableH: number
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
 * Rectángulo (en coordenadas de flujo) que la exportación PDF realmente capturará:
 * simula el `fitView` que `prepareExportCapture` aplica sobre un lienzo del tamaño de exportación.
 * Devuelve `null` si aún no hay nodos medidos.
 */
export function computeExportCaptureRect(
  nodes: Node[],
  orientation: PrintOrientation = 'landscape'
): { x: number; y: number; width: number; height: number } | null {
  if (nodes.length === 0) return null
  const bounds = getNodesBounds(nodes)
  if (!(bounds.width > 0) || !(bounds.height > 0)) return null
  const { w: shellW, h: shellH } = getExportShellCssDimensions(nodes.length, orientation)
  const vp = getViewportForBounds(
    bounds,
    shellW,
    shellH,
    EXPORT_FIT_MIN_ZOOM,
    EXPORT_FIT_MAX_ZOOM,
    EXPORT_FIT_PADDING
  )
  if (!Number.isFinite(vp.zoom) || vp.zoom <= 0) return null
  return {
    x: -vp.x / vp.zoom,
    y: -vp.y / vp.zoom,
    width: shellW / vp.zoom,
    height: shellH / vp.zoom,
  }
}
