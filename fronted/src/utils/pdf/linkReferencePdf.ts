import type { jsPDF } from 'jspdf'
import { getPaperGeometry, type PaperFormat, type PrintOrientation } from './a4Geometry'
import { drawFooter, drawHeader, type PdfHeaderBranding } from './pdfChrome'
import {
  drawPdfTableBody,
  drawPdfTableHeader,
  getPdfTableLayout,
  paginatePdfRows,
  type PdfTableColumn,
} from './pdfTable'

export type LinkReferenceRow = {
  code: string
  reference: string
  description: string
}

const LINK_REF_COLUMNS: PdfTableColumn[] = [
  { header: 'ID', proportion: 0.1 },
  { header: 'Referencia', proportion: 0.62 },
  { header: 'Descripción', proportion: 0.28 },
]

function toCells(row: LinkReferenceRow): string[] {
  return [row.code, row.reference, row.description || '—']
}

export function countLinkReferencePages(
  pdf: jsPDF,
  format: PaperFormat,
  orientation: PrintOrientation,
  rows: LinkReferenceRow[],
): number {
  if (!rows.length) return 0
  const geom = getPaperGeometry(format, orientation)
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    geom.table.y,
    geom.table.y + geom.table.h,
    LINK_REF_COLUMNS,
    rows,
    toCells,
  )
  return pages.length
}

export function drawLinkReferencePages(
  pdf: jsPDF,
  opts: {
    rows: LinkReferenceRow[]
    format: PaperFormat
    orientation: PrintOrientation
    title: string
    projectName?: string
    authorName?: string
    dateStr: string
    branding?: PdfHeaderBranding
    startingPageNumber: number
    totalPages: number
  },
): number {
  const { rows, format, orientation, title, projectName, authorName, dateStr, branding } = opts
  if (!rows.length) return 0

  const geom = getPaperGeometry(format, orientation)
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    geom.table.y,
    geom.table.y + geom.table.h,
    LINK_REF_COLUMNS,
    rows,
    toCells,
  )

  for (let i = 0; i < pages.length; i++) {
    pdf.addPage(format, orientation)
    const pw = geom.pageW
    const ph = geom.pageH
    const pageLabel =
      pages.length > 1
        ? `Referencia de enlaces (${i + 1}/${pages.length})`
        : 'Referencia de enlaces'

    drawHeader(
      pdf,
      pw,
      title,
      projectName,
      `${rows.length} enlace(s) · ${pageLabel}`,
      authorName,
      dateStr,
      branding,
    )

    const layout = getPdfTableLayout(pw, LINK_REF_COLUMNS)
    drawPdfTableHeader(pdf, geom.table.y, layout, LINK_REF_COLUMNS)
    drawPdfTableBody(
      pdf,
      geom.table.y,
      layout,
      pages[i].map(toCells),
    )
    drawFooter(
      pdf,
      pw,
      ph,
      opts.startingPageNumber + i,
      opts.totalPages,
      dateStr,
      pageLabel,
    )
  }

  return pages.length
}
