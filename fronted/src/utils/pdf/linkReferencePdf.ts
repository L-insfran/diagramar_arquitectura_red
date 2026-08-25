import type { jsPDF } from 'jspdf'
import { getPaperGeometry, type PaperFormat, type PrintOrientation } from './a4Geometry'
import { drawFooter, drawHeader, type PdfHeaderBranding } from './pdfChrome'
import {
  drawPdfGroupedTableHeader,
  drawPdfMergedTableBody,
  drawPdfTableBody,
  drawPdfTableHeader,
  getPdfGroupedHeaderHeight,
  getPdfTableLayout,
  paginatePdfRows,
  type PdfMergedCellSpan,
  type PdfTableColumn,
  type PdfTableGroup,
} from './pdfTable'

/** Formato de la tabla de referencia de enlaces en el PDF. */
export type LinkTableFormat = 'table' | 'path'

/** Fila clásica (origen / destino como path en una celda). */
export type LinkReferenceRow = {
  code: string
  origin: string
  destination: string
  description: string
}

/** Fila de ruta lineal (segmentos por columna, como en pantalla). */
export type LinkPathReferenceRow = {
  code: string
  originSite: string
  originArea: string
  originContainer: string
  originDevice: string
  originPort: string
  cable: string
  destinationPort: string
  destinationDevice: string
  destinationContainer: string
  destinationArea: string
  destinationSite: string
  description: string
}

const LINK_REF_COLUMNS: PdfTableColumn[] = [
  { header: 'ID', proportion: 0.08 },
  { header: 'Origen', proportion: 0.31 },
  { header: 'Destino', proportion: 0.31 },
  { header: 'Descripción', proportion: 0.3 },
]

const LINK_PATH_COLUMNS: PdfTableColumn[] = [
  { header: 'ID', proportion: 0.05 },
  { header: 'Sitio', proportion: 0.09 },
  { header: 'Área', proportion: 0.08 },
  { header: 'Cont.', proportion: 0.08 },
  { header: 'Equipo', proportion: 0.08 },
  { header: 'Puerto', proportion: 0.055 },
  { header: 'Enlace', proportion: 0.07 },
  { header: 'Puerto', proportion: 0.055 },
  { header: 'Equipo', proportion: 0.08 },
  { header: 'Cont.', proportion: 0.08 },
  { header: 'Área', proportion: 0.08 },
  { header: 'Sitio', proportion: 0.09 },
  { header: 'Desc.', proportion: 0.11 },
]

const LINK_PATH_GROUPS: PdfTableGroup[] = [
  { label: '', span: 1 },
  { label: 'ORIGEN', span: 5 },
  { label: 'ENLACE', span: 1 },
  { label: 'DESTINO', span: 5 },
  { label: '', span: 1 },
]

const PATH_FONT_SIZE = 6
const PATH_COL_COUNT = LINK_PATH_COLUMNS.length

function cellOrDash(value: string | null | undefined): string {
  const t = value?.trim()
  return t || '—'
}

function samePathText(a: string | null | undefined, b: string | null | undefined): boolean {
  return cellOrDash(a).localeCompare(cellOrDash(b), 'es', { sensitivity: 'accent' }) === 0
}

function toClassicCells(row: LinkReferenceRow): string[] {
  return [row.code, row.origin, row.destination, row.description || '—']
}

function toPathCells(row: LinkPathReferenceRow): string[] {
  return [
    row.code,
    cellOrDash(row.originSite),
    cellOrDash(row.originArea),
    cellOrDash(row.originContainer),
    cellOrDash(row.originDevice),
    cellOrDash(row.originPort),
    cellOrDash(row.cable),
    cellOrDash(row.destinationPort),
    cellOrDash(row.destinationDevice),
    cellOrDash(row.destinationContainer),
    cellOrDash(row.destinationArea),
    cellOrDash(row.destinationSite),
    cellOrDash(row.description),
  ]
}

/**
 * Matriz de rowspan por página: cascada Sitio→Área→Cont→Equipo (origen/destino) + cable.
 * ID, puertos y descripción nunca se fusionan.
 */
export function computePathCellSpans(rows: LinkPathReferenceRow[]): PdfMergedCellSpan[][] {
  const n = rows.length
  const spans: PdfMergedCellSpan[][] = Array.from({ length: n }, () =>
    Array.from({ length: PATH_COL_COUNT }, () => ({ rowSpan: 1 })),
  )
  if (n === 0) return spans

  type MergeRule = {
    col: number
    isContinuation: (prev: LinkPathReferenceRow, curr: LinkPathReferenceRow) => boolean
  }

  const rules: MergeRule[] = [
    {
      col: 1,
      isContinuation: (prev, curr) => samePathText(prev.originSite, curr.originSite),
    },
    {
      col: 2,
      isContinuation: (prev, curr) =>
        samePathText(prev.originSite, curr.originSite) &&
        samePathText(prev.originArea, curr.originArea),
    },
    {
      col: 3,
      isContinuation: (prev, curr) =>
        samePathText(prev.originSite, curr.originSite) &&
        samePathText(prev.originArea, curr.originArea) &&
        samePathText(prev.originContainer, curr.originContainer),
    },
    {
      col: 4,
      isContinuation: (prev, curr) =>
        samePathText(prev.originSite, curr.originSite) &&
        samePathText(prev.originArea, curr.originArea) &&
        samePathText(prev.originContainer, curr.originContainer) &&
        samePathText(prev.originDevice, curr.originDevice),
    },
    {
      col: 6,
      isContinuation: (prev, curr) =>
        samePathText(prev.originSite, curr.originSite) &&
        samePathText(prev.originArea, curr.originArea) &&
        samePathText(prev.originContainer, curr.originContainer) &&
        samePathText(prev.originDevice, curr.originDevice) &&
        samePathText(prev.cable, curr.cable),
    },
    {
      col: 8,
      isContinuation: (prev, curr) =>
        samePathText(prev.destinationSite, curr.destinationSite) &&
        samePathText(prev.destinationArea, curr.destinationArea) &&
        samePathText(prev.destinationContainer, curr.destinationContainer) &&
        samePathText(prev.destinationDevice, curr.destinationDevice),
    },
    {
      col: 9,
      isContinuation: (prev, curr) =>
        samePathText(prev.destinationSite, curr.destinationSite) &&
        samePathText(prev.destinationArea, curr.destinationArea) &&
        samePathText(prev.destinationContainer, curr.destinationContainer),
    },
    {
      col: 10,
      isContinuation: (prev, curr) =>
        samePathText(prev.destinationSite, curr.destinationSite) &&
        samePathText(prev.destinationArea, curr.destinationArea),
    },
    {
      col: 11,
      isContinuation: (prev, curr) => samePathText(prev.destinationSite, curr.destinationSite),
    },
  ]

  for (const rule of rules) {
    let i = 0
    while (i < n) {
      let span = 1
      while (i + span < n && rule.isContinuation(rows[i + span - 1], rows[i + span])) {
        span++
      }
      spans[i][rule.col] = { rowSpan: span }
      for (let k = 1; k < span; k++) {
        spans[i + k][rule.col] = { skip: true }
      }
      i += span
    }
  }

  return spans
}

export function countLinkReferencePages(
  pdf: jsPDF,
  format: PaperFormat,
  orientation: PrintOrientation,
  rows: LinkReferenceRow[],
  linkFormat: LinkTableFormat = 'table',
  pathRows: LinkPathReferenceRow[] = [],
): number {
  if (linkFormat === 'path') {
    if (!pathRows.length) return 0
    const geom = getPaperGeometry(format, orientation)
    const pages = paginatePdfRows(
      pdf,
      geom.pageW,
      geom.table.y,
      geom.table.y + geom.table.h,
      LINK_PATH_COLUMNS,
      pathRows,
      toPathCells,
      { fontSize: PATH_FONT_SIZE, headerHeight: getPdfGroupedHeaderHeight() },
    )
    return pages.length
  }

  if (!rows.length) return 0
  const geom = getPaperGeometry(format, orientation)
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    geom.table.y,
    geom.table.y + geom.table.h,
    LINK_REF_COLUMNS,
    rows,
    toClassicCells,
  )
  return pages.length
}

export function drawLinkReferencePages(
  pdf: jsPDF,
  opts: {
    rows: LinkReferenceRow[]
    pathRows?: LinkPathReferenceRow[]
    linkFormat?: LinkTableFormat
    format: PaperFormat
    orientation: PrintOrientation
    title: string
    projectName?: string
    clientName?: string
    authorName?: string
    dateStr: string
    branding?: PdfHeaderBranding
    startingPageNumber: number
    totalPages: number
    invertColors?: boolean
  },
): number {
  const {
    rows,
    pathRows = [],
    linkFormat = 'table',
    format,
    orientation,
    title,
    projectName,
    clientName,
    authorName,
    dateStr,
    branding,
    invertColors,
  } = opts

  if (linkFormat === 'path') {
    return drawPathPages(pdf, {
      rows: pathRows,
      format,
      orientation,
      title,
      projectName,
      clientName,
      authorName,
      dateStr,
      branding,
      startingPageNumber: opts.startingPageNumber,
      totalPages: opts.totalPages,
      invertColors,
    })
  }

  if (!rows.length) return 0

  const geom = getPaperGeometry(format, orientation)
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    geom.table.y,
    geom.table.y + geom.table.h,
    LINK_REF_COLUMNS,
    rows,
    toClassicCells,
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
      pageLabel,
      authorName,
      dateStr,
      branding,
      invertColors,
      clientName,
    )

    const layout = getPdfTableLayout(pw, LINK_REF_COLUMNS)
    drawPdfTableHeader(pdf, geom.table.y, layout, LINK_REF_COLUMNS)
    drawPdfTableBody(
      pdf,
      geom.table.y,
      layout,
      pages[i].map(toClassicCells),
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

function drawPathPages(
  pdf: jsPDF,
  opts: {
    rows: LinkPathReferenceRow[]
    format: PaperFormat
    orientation: PrintOrientation
    title: string
    projectName?: string
    clientName?: string
    authorName?: string
    dateStr: string
    branding?: PdfHeaderBranding
    startingPageNumber: number
    totalPages: number
    invertColors?: boolean
  },
): number {
  const {
    rows,
    format,
    orientation,
    title,
    projectName,
    clientName,
    authorName,
    dateStr,
    branding,
    invertColors,
  } = opts
  if (!rows.length) return 0

  const geom = getPaperGeometry(format, orientation)
  const headerH = getPdfGroupedHeaderHeight()
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    geom.table.y,
    geom.table.y + geom.table.h,
    LINK_PATH_COLUMNS,
    rows,
    toPathCells,
    { fontSize: PATH_FONT_SIZE, headerHeight: headerH },
  )

  for (let i = 0; i < pages.length; i++) {
    pdf.addPage(format, orientation)
    const pw = geom.pageW
    const ph = geom.pageH
    const pageLabel =
      pages.length > 1
        ? `Ruta lineal de enlaces (${i + 1}/${pages.length})`
        : 'Ruta lineal de enlaces'

    drawHeader(
      pdf,
      pw,
      title,
      projectName,
      pageLabel,
      authorName,
      dateStr,
      branding,
      invertColors,
      clientName,
    )

    const pageRows = pages[i]
    const layout = getPdfTableLayout(pw, LINK_PATH_COLUMNS)
    drawPdfGroupedTableHeader(pdf, geom.table.y, layout, LINK_PATH_GROUPS, LINK_PATH_COLUMNS)
    drawPdfMergedTableBody(
      pdf,
      geom.table.y,
      layout,
      pageRows.map(toPathCells),
      computePathCellSpans(pageRows),
      { fontSize: PATH_FONT_SIZE, headerHeight: headerH },
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
