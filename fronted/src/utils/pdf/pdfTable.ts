import type { jsPDF } from 'jspdf'
import { MARGIN } from './a4Geometry'

export type PdfTableColumn = {
  header: string
  /** Proporción del ancho disponible (suma ≈ 1). */
  proportion: number
}

export type PdfTableLayout = {
  colWidths: number[]
  tableW: number
  startX: number
}

const TABLE_HEADER_H = 8
const TABLE_LINE_H = 3.4
const TABLE_PAD_Y = 1.6
const TABLE_FONT_SIZE = 7

export function getPdfTableLayout(pageW: number, columns: PdfTableColumn[]): PdfTableLayout {
  const availW = pageW - MARGIN * 2
  const colWidths = columns.map((c) => c.proportion * availW)
  const tableW = colWidths.reduce((a, b) => a + b, 0)
  const startX = MARGIN + (availW - tableW) / 2
  return { colWidths, tableW, startX }
}

export function wrapPdfCells(pdf: jsPDF, cells: string[], colWidths: number[]): string[][] {
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(TABLE_FONT_SIZE)
  return cells.map((cell, i) => {
    const maxW = Math.max(6, colWidths[i] - 3)
    return pdf.splitTextToSize(cell, maxW) as string[]
  })
}

export function measurePdfRowHeight(wrapped: string[][]): number {
  const maxLines = Math.max(1, ...wrapped.map((lines) => lines.length))
  return Math.max(6.5, maxLines * TABLE_LINE_H + TABLE_PAD_Y * 2)
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
): T[][] {
  const { colWidths } = getPdfTableLayout(pageW, columns)
  const pages: T[][] = []
  let current: T[] = []
  let y = bodyStartY + TABLE_HEADER_H

  for (const row of rows) {
    const wrapped = wrapPdfCells(pdf, toCells(row), colWidths)
    const rowH = measurePdfRowHeight(wrapped)
    if (current.length > 0 && y + rowH > maxY) {
      pages.push(current)
      current = []
      y = bodyStartY + TABLE_HEADER_H
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
 * Dibuja filas de una página de tabla (zebra + wrap + bordes).
 * `cellColors` opcional: por celda, color RGB o null (default).
 */
export function drawPdfTableBody(
  pdf: jsPDF,
  startY: number,
  layout: PdfTableLayout,
  rows: string[][],
  cellColors?: Array<Array<[number, number, number] | null>>,
): number {
  const { colWidths, tableW, startX } = layout
  let y = startY + TABLE_HEADER_H

  for (let ei = 0; ei < rows.length; ei++) {
    const wrapped = wrapPdfCells(pdf, rows[ei], colWidths)
    const rowH = measurePdfRowHeight(wrapped)

    if (ei % 2 === 0) {
      pdf.setFillColor(240, 247, 252)
      pdf.rect(startX, y, tableW, rowH, 'F')
    }

    let cx = startX
    pdf.setFontSize(TABLE_FONT_SIZE)
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
      let textY = y + TABLE_PAD_Y + TABLE_LINE_H
      for (const line of lines) {
        pdf.text(line, textX, textY)
        textY += TABLE_LINE_H
      }
      cx += colWidths[i]
    }
    y += rowH
  }

  pdf.setDrawColor(203, 213, 225)
  pdf.setLineWidth(0.2)
  pdf.rect(startX, startY, tableW, y - startY)
  let cx = startX
  for (let i = 0; i < colWidths.length - 1; i++) {
    cx += colWidths[i]
    pdf.line(cx, startY, cx, y)
  }

  return y
}

export { TABLE_HEADER_H }
