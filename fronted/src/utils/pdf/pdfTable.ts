import type { jsPDF } from 'jspdf'
import { MARGIN } from './a4Geometry'

export type PdfTableColumn = {
  header: string
  /** Proporción del ancho disponible (suma ≈ 1). */
  proportion: number
}

/** Grupo de columnas (fila superior del encabezado). */
export type PdfTableGroup = {
  label: string
  /** Cantidad de columnas hoja que abarca. */
  span: number
}

export type PdfTableLayout = {
  colWidths: number[]
  tableW: number
  startX: number
}

export type PdfTableDrawOptions = {
  fontSize?: number
  /** Altura total del encabezado (grupo + hoja, o solo hoja). */
  headerHeight?: number
}

const TABLE_HEADER_H = 8
const TABLE_GROUP_HEADER_H = 5
const TABLE_LINE_H = 3.4
const TABLE_PAD_Y = 1.6
const TABLE_FONT_SIZE = 7
/** Tipografía densa (path / FIC): filas de una línea ~4.6 mm. */
const COMPACT_LINE_H = 2.5
const COMPACT_PAD_Y = 0.9
const COMPACT_MIN_ROW_H = 4.6
const NORMAL_MIN_ROW_H = 6.5

/** Zebra sutil (gris claro). */
const ZEBRA_RGB: [number, number, number] = [248, 250, 252]
/** Bordes de grilla neutros. */
const GRID_RGB: [number, number, number] = [226, 232, 240]
const GRID_LINE_W = 0.15

type RowMetrics = { lineH: number; padY: number; minH: number }

function rowMetrics(fontSize: number): RowMetrics {
  if (fontSize <= 6) {
    return { lineH: COMPACT_LINE_H, padY: COMPACT_PAD_Y, minH: COMPACT_MIN_ROW_H }
  }
  return { lineH: TABLE_LINE_H, padY: TABLE_PAD_Y, minH: NORMAL_MIN_ROW_H }
}

export function getPdfTableLayout(pageW: number, columns: PdfTableColumn[]): PdfTableLayout {
  const availW = pageW - MARGIN * 2
  const colWidths = columns.map((c) => c.proportion * availW)
  const tableW = colWidths.reduce((a, b) => a + b, 0)
  const startX = MARGIN + (availW - tableW) / 2
  return { colWidths, tableW, startX }
}

export function getPdfGroupedHeaderHeight(): number {
  return TABLE_GROUP_HEADER_H + TABLE_HEADER_H
}

export function wrapPdfCells(
  pdf: jsPDF,
  cells: string[],
  colWidths: number[],
  fontSize = TABLE_FONT_SIZE,
): string[][] {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(fontSize)
  return cells.map((cell, i) => {
    const maxW = Math.max(4, colWidths[i] - 2.5)
    return pdf.splitTextToSize(cell, maxW) as string[]
  })
}

export function measurePdfRowHeight(wrapped: string[][], fontSize = TABLE_FONT_SIZE): number {
  const { lineH, padY, minH } = rowMetrics(fontSize)
  const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length))
  return Math.max(minH, maxLines * lineH + padY * 2)
}

/**
 * Pagina filas genéricas midiendo altura con wrap de texto.
 */
export function paginatePdfRows<T>(
  pdf: jsPDF,
  pageW: number,
  bodyStartY: number,
  maxY: number,
  columns: PdfTableColumn[],
  rows: T[],
  toCells: (row: T) => string[],
  options?: PdfTableDrawOptions,
): T[][] {
  const headerH = options?.headerHeight ?? TABLE_HEADER_H
  const fontSize = options?.fontSize ?? TABLE_FONT_SIZE
  const { colWidths } = getPdfTableLayout(pageW, columns)
  const pages: T[][] = []
  let current: T[] = []
  let y = bodyStartY + headerH

  for (const row of rows) {
    const wrapped = wrapPdfCells(pdf, toCells(row), colWidths, fontSize)
    const rowH = measurePdfRowHeight(wrapped, fontSize)
    if (current.length > 0 && y + rowH > maxY) {
      pages.push(current)
      current = []
      y = bodyStartY + headerH
    }
    current.push(row)
    y += rowH
  }

  if (current.length) pages.push(current)
  return pages.length ? pages : [[]]
}

export function drawPdfTableHeader(
  pdf: jsPDF,
  startY: number,
  layout: PdfTableLayout,
  columns: PdfTableColumn[],
) {
  const { colWidths, tableW, startX } = layout
  pdf.setFillColor(15, 23, 42)
  pdf.rect(startX, startY, tableW, TABLE_HEADER_H, 'F')
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)

  let cx = startX
  for (let i = 0; i < columns.length; i++) {
    pdf.text(columns[i].header, cx + 1.5, startY + 5.2)
    cx += colWidths[i]
  }
}

/**
 * Encabezado de dos filas: grupos (ORIGEN / DESTINO…) + columnas hoja.
 * Devuelve la altura total del encabezado.
 */
export function drawPdfGroupedTableHeader(
  pdf: jsPDF,
  startY: number,
  layout: PdfTableLayout,
  groups: PdfTableGroup[],
  columns: PdfTableColumn[],
): number {
  const { colWidths, tableW, startX } = layout
  const totalH = getPdfGroupedHeaderHeight()

  // Fila de grupos (tono más claro) + fila hoja (navy)
  pdf.setFillColor(30, 41, 59)
  pdf.rect(startX, startY, tableW, TABLE_GROUP_HEADER_H, 'F')
  pdf.setFillColor(15, 23, 42)
  pdf.rect(startX, startY + TABLE_GROUP_HEADER_H, tableW, TABLE_HEADER_H, 'F')

  pdf.setDrawColor(71, 85, 105)
  pdf.setLineWidth(GRID_LINE_W)

  // Fila de grupos
  pdf.setFontSize(5.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(203, 213, 225)
  let gx = startX
  let colIndex = 0
  for (const group of groups) {
    let spanW = 0
    for (let i = 0; i < group.span; i++) {
      spanW += colWidths[colIndex + i] ?? 0
    }
    if (group.label) {
      const labelW = pdf.getTextWidth(group.label)
      pdf.text(group.label, gx + Math.max(1, (spanW - labelW) / 2), startY + 3.6)
    }
    if (colIndex + group.span < columns.length) {
      pdf.line(gx + spanW, startY, gx + spanW, startY + TABLE_GROUP_HEADER_H)
    }
    gx += spanW
    colIndex += group.span
  }
  pdf.setDrawColor(51, 65, 85)
  pdf.line(startX, startY + TABLE_GROUP_HEADER_H, startX + tableW, startY + TABLE_GROUP_HEADER_H)

  // Fila de columnas hoja
  const leafY = startY + TABLE_GROUP_HEADER_H
  pdf.setFontSize(5.5)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  let cx = startX
  for (let i = 0; i < columns.length; i++) {
    pdf.text(columns[i].header, cx + 1, leafY + 5)
    cx += colWidths[i]
  }

  return totalH
}

/**
 * Dibuja filas de una página de tabla (zebra + wrap + bordes).
 * `cellColors` opcional: por celda, color RGB o null (default).
 */
export function drawPdfTableBody(
  pdf: jsPDF,
  startY: number,
  layout: PdfTableLayout,
  rows: string[][],
  cellColors?: Array<Array<[number, number, number] | null>>,
  options?: PdfTableDrawOptions,
): number {
  const headerH = options?.headerHeight ?? TABLE_HEADER_H
  const fontSize = options?.fontSize ?? TABLE_FONT_SIZE
  const { lineH, padY } = rowMetrics(fontSize)
  const { colWidths, tableW, startX } = layout
  let y = startY + headerH

  for (let ei = 0; ei < rows.length; ei++) {
    const wrapped = wrapPdfCells(pdf, rows[ei], colWidths, fontSize)
    const rowH = measurePdfRowHeight(wrapped, fontSize)

    if (ei % 2 === 0) {
      pdf.setFillColor(ZEBRA_RGB[0], ZEBRA_RGB[1], ZEBRA_RGB[2])
      pdf.rect(startX, y, tableW, rowH, 'F')
    }

    let cx = startX
    pdf.setFontSize(fontSize)
    pdf.setFont('helvetica', 'normal')

    for (let i = 0; i < wrapped.length; i++) {
      const color = cellColors?.[ei]?.[i]
      if (color) {
        pdf.setTextColor(color[0], color[1], color[2])
      } else {
        pdf.setTextColor(15, 23, 42)
      }
      const lines = wrapped[i]
      const textX = cx + 1.5
      let textY = y + padY + lineH
      for (const line of lines) {
        pdf.text(line, textX, textY)
        textY += lineH
      }
      cx += colWidths[i]
    }
    y += rowH
  }

  pdf.setDrawColor(GRID_RGB[0], GRID_RGB[1], GRID_RGB[2])
  pdf.setLineWidth(GRID_LINE_W)
  pdf.rect(startX, startY, tableW, y - startY)
  let cx = startX
  for (let i = 0; i < colWidths.length - 1; i++) {
    cx += colWidths[i]
    pdf.line(cx, startY, cx, y)
  }

  return y
}

/** Span de celda: inicio de bloque (rowSpan) o continuación (skip). */
export type PdfMergedCellSpan = { rowSpan: number } | { skip: true }

/**
 * Cuerpo de tabla con celdas fusionadas verticalmente (rowspan simulado).
 * El texto del bloque se dibuja una sola vez, centrado en el rectángulo del span.
 * No se dibujan líneas horizontales internas dentro de un merge.
 */
export function drawPdfMergedTableBody(
  pdf: jsPDF,
  startY: number,
  layout: PdfTableLayout,
  rows: string[][],
  spans: PdfMergedCellSpan[][],
  options?: PdfTableDrawOptions,
): number {
  const headerH = options?.headerHeight ?? TABLE_HEADER_H
  const fontSize = options?.fontSize ?? TABLE_FONT_SIZE
  const { lineH } = rowMetrics(fontSize)
  const { colWidths, tableW, startX } = layout
  const colCount = colWidths.length

  const rowHeights: number[] = []
  for (let ei = 0; ei < rows.length; ei++) {
    const measureCells = rows[ei].map((cell, ci) => {
      const span = spans[ei]?.[ci]
      return span && 'skip' in span ? '' : cell
    })
    const wrapped = wrapPdfCells(pdf, measureCells, colWidths, fontSize)
    rowHeights.push(measurePdfRowHeight(wrapped, fontSize))
  }

  const rowYs: number[] = []
  let y = startY + headerH
  for (let ei = 0; ei < rows.length; ei++) {
    rowYs.push(y)
    if (ei % 2 === 0) {
      pdf.setFillColor(ZEBRA_RGB[0], ZEBRA_RGB[1], ZEBRA_RGB[2])
      pdf.rect(startX, y, tableW, rowHeights[ei], 'F')
    }
    y += rowHeights[ei]
  }
  const bodyBottom = y

  pdf.setFontSize(fontSize)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(15, 23, 42)

  for (let ei = 0; ei < rows.length; ei++) {
    let cx = startX
    for (let ci = 0; ci < colCount; ci++) {
      const span = spans[ei]?.[ci] ?? { rowSpan: 1 }
      if ('skip' in span) {
        cx += colWidths[ci]
        continue
      }

      const rowSpan = Math.max(1, span.rowSpan)
      let blockH = 0
      for (let k = 0; k < rowSpan; k++) {
        blockH += rowHeights[ei + k] ?? 0
      }

      const text = rows[ei][ci] ?? ''
      const lines = wrapPdfCells(pdf, [text], [colWidths[ci]], fontSize)[0]
      const textH = Math.max(lineH, lines.length * lineH)
      const blockTop = rowYs[ei]
      let textY = blockTop + (blockH - textH) / 2 + lineH * 0.85
      const centerX = cx + colWidths[ci] / 2

      for (const line of lines) {
        pdf.text(line, centerX, textY, { align: 'center' })
        textY += lineH
      }
      cx += colWidths[ci]
    }
  }

  pdf.setDrawColor(GRID_RGB[0], GRID_RGB[1], GRID_RGB[2])
  pdf.setLineWidth(GRID_LINE_W)
  pdf.rect(startX, startY, tableW, bodyBottom - startY)

  let vx = startX
  for (let i = 0; i < colCount - 1; i++) {
    vx += colWidths[i]
    pdf.line(vx, startY, vx, bodyBottom)
  }

  // Líneas horizontales entre filas, omitiendo segmentos dentro de un merge.
  for (let ei = 0; ei < rows.length - 1; ei++) {
    const lineY = rowYs[ei] + rowHeights[ei]
    let cx = startX
    for (let ci = 0; ci < colCount; ci++) {
      const next = spans[ei + 1]?.[ci]
      const insideMerge = Boolean(next && 'skip' in next)
      if (!insideMerge) {
        pdf.line(cx, lineY, cx + colWidths[ci], lineY)
      }
      cx += colWidths[ci]
    }
  }

  // Separador bajo el encabezado
  pdf.line(startX, startY + headerH, startX + tableW, startY + headerH)

  return bodyBottom
}

export { TABLE_HEADER_H, TABLE_GROUP_HEADER_H, TABLE_FONT_SIZE }
