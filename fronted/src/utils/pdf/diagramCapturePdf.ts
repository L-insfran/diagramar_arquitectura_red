import { toPng } from 'html-to-image'
import type { jsPDF } from 'jspdf'
import {
  FOOTER_H,
  HEADER_H,
  getPaperGeometry,
  type PaperFormat,
  type PrintOrientation,
} from './a4Geometry'
import { TILE_OVERLAP_MM, type DiagramPagePlan } from './diagramScale'
import {
  drawFooter,
  drawGridIndicator,
  drawHeader,
  drawLegend,
  drawSectorHeader,
  type PdfHeaderBranding,
} from './pdfChrome'

export type CapturedDiagram = {
  imgData: string
  imgW: number
  imgH: number
  plan: DiagramPagePlan
}

/**
 * Carga la imagen y dibuja portada + sectores ampliados.
 */
export async function appendDiagramPagesAsync(
  pdf: jsPDF,
  opts: {
    captured: CapturedDiagram
    orientation: PrintOrientation
    /** Default `a4` para compatibilidad con topología. */
    format?: PaperFormat
    title: string
    subtitle?: string
    projectName?: string
    authorName?: string
    dateStr: string
    startingPageNumber: number
    totalPages: number
    firstPageExists?: boolean
    branding?: PdfHeaderBranding
    /** Si es false, no dibuja la leyenda y usa el espacio extra para el diagrama. Default true. */
    includeLegend?: boolean
  },
): Promise<number> {
  const {
    captured,
    orientation,
    title,
    subtitle,
    projectName,
    authorName,
    dateStr,
    startingPageNumber,
    totalPages,
    firstPageExists,
    branding,
  } = opts
  const format: PaperFormat = opts.format ?? 'a4'
  const includeLegend = opts.includeLegend !== false

  const { imgData, imgW, imgH, plan } = captured
  const { cols, rows } = plan
  const totalDiagramPages = cols * rows
  const geom = getPaperGeometry(format, orientation)
  const cover = includeLegend
    ? geom.cover
    : {
        ...geom.cover,
        h: geom.pageH - HEADER_H - FOOTER_H - 4,
      }

  const img = new Image()
  img.src = imgData
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('No se pudo cargar la captura del diagrama'))
  })

  if (!firstPageExists) {
    pdf.addPage(format, orientation)
  }

  const pw = geom.pageW
  const ph = geom.pageH

  drawHeader(pdf, pw, title, projectName, subtitle, authorName, dateStr, branding)

  const imgAspect = imgW / Math.max(1, imgH)
  let drawW = cover.w
  let drawH = drawW / imgAspect
  if (drawH > cover.h) {
    drawH = cover.h
    drawW = drawH * imgAspect
  }
  const drawX = cover.x + (cover.w - drawW) / 2
  const drawY = cover.y + (cover.h - drawH) / 2
  pdf.addImage(imgData, 'PNG', drawX, drawY, drawW, drawH)

  if (includeLegend) {
    drawLegend(pdf, pw, ph)
  }
  drawFooter(pdf, pw, ph, startingPageNumber, totalPages, dateStr, 'Vista general')

  if (totalDiagramPages > 1) {
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(120, 120, 120)
    pdf.text(
      `El diagrama se divide en ${totalDiagramPages} sectores (${cols}×${rows}) a tamaño legible. Cada página siguiente muestra un sector ampliado a ancho útil.`,
      cover.x,
      ph - 16 - 12 - 8,
      { maxWidth: cover.w },
    )
  }

  let pagesAdded = 1
  if (totalDiagramPages <= 1) return pagesAdded

  const baseTileW = imgW / cols
  const baseTileH = imgH / rows
  const totalMmW = cols * geom.sector.w
  const mmPerImgPx = totalMmW / Math.max(1, imgW)
  const overlapPx = Math.max(0, Math.round(TILE_OVERLAP_MM / Math.max(mmPerImgPx, 1e-6)))

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      pdf.addPage(format, orientation)
      pagesAdded++
      const pageNum = startingPageNumber + pagesAdded - 1
      const sectorNum = row * cols + col + 1
      const sectorLabel = `Sector ${sectorNum} de ${totalDiagramPages} (fila ${row + 1}, columna ${col + 1})`

      drawSectorHeader(pdf, pw, title, projectName, sectorLabel)

      let sx = col * baseTileW - (col > 0 ? overlapPx : 0)
      let sy = row * baseTileH - (row > 0 ? overlapPx : 0)
      let sw = baseTileW + (col > 0 ? overlapPx : 0) + (col < cols - 1 ? overlapPx : 0)
      let sh = baseTileH + (row > 0 ? overlapPx : 0) + (row < rows - 1 ? overlapPx : 0)
      sx = Math.max(0, sx)
      sy = Math.max(0, sy)
      sw = Math.min(sw, imgW - sx)
      sh = Math.min(sh, imgH - sy)

      const sectorCanvas = document.createElement('canvas')
      sectorCanvas.width = Math.max(1, Math.ceil(sw))
      sectorCanvas.height = Math.max(1, Math.ceil(sh))
      const ctx2d = sectorCanvas.getContext('2d')!
      ctx2d.fillStyle = '#ffffff'
      ctx2d.fillRect(0, 0, sectorCanvas.width, sectorCanvas.height)
      ctx2d.drawImage(img, sx, sy, sw, sh, 0, 0, sectorCanvas.width, sectorCanvas.height)
      const sectorImg = sectorCanvas.toDataURL('image/png')

      pdf.addImage(sectorImg, 'PNG', geom.sector.x, geom.sector.y, geom.sector.w, geom.sector.h)

      drawGridIndicator(pdf, pw, cols, rows, col, row)
      drawFooter(pdf, pw, ph, pageNum, totalPages, dateStr, sectorLabel)
    }
  }

  return pagesAdded
}

/**
 * Filtra nodos UI de React Flow al capturar.
 */
export function reactFlowCaptureFilter(node: Element): boolean {
  // Overlay de márgenes/sectores de impresión — nunca debe salir en el PDF.
  if (
    node instanceof Element &&
    (node.getAttribute('data-print-bounds-overlay') === 'true' ||
      node.closest?.('[data-print-bounds-overlay="true"]'))
  ) {
    return false
  }
  if (node instanceof HTMLElement) {
    const cl = node.classList
    if (
      cl.contains('react-flow__controls') ||
      cl.contains('react-flow__minimap') ||
      cl.contains('react-flow__panel') ||
      cl.contains('react-flow__attribution')
    ) {
      return false
    }
  }
  return true
}

/**
 * Rasteriza el viewport de React Flow con dimensiones y transform explícitos
 * (receta oficial: sin redimensionar el shell ni llamar fitView).
 */
export async function captureReactFlowViewport(opts: {
  canvasElement: HTMLElement
  cssW: number
  cssH: number
  pixelRatio: number
  viewport: { x: number; y: number; zoom: number }
}): Promise<string> {
  const { canvasElement, cssW, cssH, pixelRatio, viewport } = opts
  const viewportEl = canvasElement.querySelector('.react-flow__viewport') as HTMLElement | null
  const targetEl = viewportEl ?? canvasElement

  return toPng(targetEl, {
    backgroundColor: '#ffffff',
    width: cssW,
    height: cssH,
    pixelRatio,
    style: {
      width: `${cssW}px`,
      height: `${cssH}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: reactFlowCaptureFilter,
  })
}

/** Páginas de diagrama: 1 portada + sectores (si >1). */
export function countDiagramPdfPages(cols: number, rows: number): number {
  const sectors = cols * rows
  return sectors <= 1 ? 1 : 1 + sectors
}
