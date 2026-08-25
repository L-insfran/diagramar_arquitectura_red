import { jsPDF } from 'jspdf'
import { getA4Geometry, MARGIN, type PrintOrientation } from './a4Geometry'
import { drawFooter, drawHeader, safePdfFilename, type PdfHeaderBranding } from './pdfChrome'
import {
  drawPdfTableBody,
  drawPdfTableHeader,
  getPdfTableLayout,
  paginatePdfRows,
  type PdfTableColumn,
} from './pdfTable'
import type { DeviceInventoryRow, DeviceInventorySummary } from '../deviceInventory'

const INVENTORY_COLUMNS: PdfTableColumn[] = [
  { header: 'Tipo', proportion: 0.16 },
  { header: 'Template', proportion: 0.34 },
  { header: 'Fabricante', proportion: 0.2 },
  { header: 'Modelo', proportion: 0.2 },
  { header: 'Cantidad', proportion: 0.1 },
]

function rowToCells(row: DeviceInventoryRow): string[] {
  return [
    row.deviceTypeName,
    row.templateName,
    row.manufacturer,
    row.model,
    String(row.count),
  ]
}

function drawTotals(pdf: jsPDF, pageH: number, summary: DeviceInventorySummary) {
  const y = pageH - 16 - 12
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(51, 65, 85)
  pdf.text('Resumen', MARGIN, y)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)
  pdf.text(
    `Total: ${summary.deviceCount} equipos · ${summary.templateCount} modelos · ${summary.typeCount} tipos`,
    MARGIN,
    y + 5,
  )
}

export type DeviceInventoryPdfOptions = {
  summary: DeviceInventorySummary
  projectName?: string
  clientName?: string
  authorName?: string
  branding?: PdfHeaderBranding
  subtitle?: string
}

export async function exportDeviceInventoryPdf(options: DeviceInventoryPdfOptions): Promise<void> {
  const { summary, projectName, clientName, authorName, branding } = options
  const orientation: PrintOrientation = 'landscape'
  const dateStr = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const title = 'Inventario de equipos por modelo'
  const subtitle =
    options.subtitle ??
    `${summary.deviceCount} equipos · ${summary.templateCount} modelos`

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const geom = getA4Geometry(orientation)
  const safeName = safePdfFilename(projectName ?? title)
  const fileName = `${safeName}_Inventario_modelos_${new Date().toISOString().slice(0, 10)}.pdf`

  if (!summary.rows.length) {
    drawHeader(
      pdf,
      geom.pageW,
      title,
      projectName,
      'Sin equipos en el alcance',
      authorName,
      dateStr,
      branding,
      undefined,
      clientName,
    )
    drawFooter(pdf, geom.pageW, geom.pageH, 1, 1, dateStr, title)
    pdf.save(fileName)
    return
  }

  const bodyStart = geom.table.y
  const maxY = geom.table.y + geom.table.h
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    bodyStart,
    maxY,
    INVENTORY_COLUMNS,
    summary.rows,
    rowToCells,
  )
  const totalPages = pages.length

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) pdf.addPage('a4', orientation)

    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const pageLabel = pages.length > 1 ? `${title} (${i + 1}/${pages.length})` : title

    drawHeader(pdf, pw, pageLabel, projectName, subtitle, authorName, dateStr, branding, undefined, clientName)

    const layout = getPdfTableLayout(pw, INVENTORY_COLUMNS)
    drawPdfTableHeader(pdf, bodyStart, layout, INVENTORY_COLUMNS)
    drawPdfTableBody(pdf, bodyStart, layout, pages[i].map(rowToCells))

    if (i === pages.length - 1) {
      drawTotals(pdf, ph, summary)
    }

    drawFooter(pdf, pw, ph, i + 1, totalPages, dateStr, pageLabel)
  }

  pdf.save(fileName)
}
