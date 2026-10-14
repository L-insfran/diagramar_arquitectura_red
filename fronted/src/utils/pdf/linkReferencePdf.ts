import type { jsPDF } from 'jspdf'
import { getPaperGeometry, type PaperFormat, type PrintOrientation } from './a4Geometry'
import { drawFooter, drawHeader, type PdfHeaderBranding } from './pdfChrome'
import { linkLineStyleDef } from '../diagram/linkTypeStyle'
import {
  drawPdfGroupedTableHeader,
  drawPdfMergedTableBody,
  drawPdfTableBody,
  drawPdfTableHeader,
  getPdfGroupedHeaderHeight,
  getPdfTableLayout,
  paginatePdfRows,
  type PdfMergedCellSpan,
  type PdfStrokeMark,
  type PdfTableColumn,
  type PdfTableDrawOptions,
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
  linkTypeName?: string | null
  linkTypeColor?: string | null
  linkTypeLineStyle?: string | null
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
  linkTypeName?: string | null
  linkTypeColor?: string | null
  linkTypeLineStyle?: string | null
}

const LINK_REF_COLUMNS: PdfTableColumn[] = [
  { header: 'ID', proportion: 0.07 },
  { header: 'Tipo', proportion: 0.2 },
  { header: 'Origen', proportion: 0.25 },
  { header: 'Destino', proportion: 0.25 },
  { header: 'Descripción', proportion: 0.23 },
]

const LINK_PATH_COLUMNS: PdfTableColumn[] = [
  { header: 'ID', proportion: 0.045 },
  { header: 'Tipo', proportion: 0.12 },
  { header: 'Sitio', proportion: 0.08 },
  { header: 'Área', proportion: 0.07 },
  { header: 'Cont.', proportion: 0.065 },
  { header: 'Equipo', proportion: 0.07 },
  { header: 'Puerto', proportion: 0.05 },
  { header: 'Enlace', proportion: 0.06 },
  { header: 'Puerto', proportion: 0.05 },
  { header: 'Equipo', proportion: 0.07 },
  { header: 'Cont.', proportion: 0.065 },
  { header: 'Área', proportion: 0.07 },
  { header: 'Sitio', proportion: 0.08 },
  { header: 'Desc.', proportion: 0.105 },
]

const LINK_PATH_GROUPS: PdfTableGroup[] = [
  { label: '', span: 1 },
  { label: '', span: 1 },
  { label: 'ORIGEN', span: 5 },
  { label: 'ENLACE', span: 1 },
  { label: 'DESTINO', span: 5 },
  { label: '', span: 1 },
]

const PATH_FONT_SIZE = 6
const PATH_COL_COUNT = LINK_PATH_COLUMNS.length
/** Columna Tipo: la muestra de trazo ocupa este margen izquierdo. */
const TYPE_COL = 1
const TYPE_TEXT_INSET = 9
const UNTAGGED_TYPE_COLOR = '#3b82f6'

const CLASSIC_DRAW: PdfTableDrawOptions = {
  textInsets: LINK_REF_COLUMNS.map((_, index) => (index === TYPE_COL ? TYPE_TEXT_INSET : 0)),
}

const PATH_DRAW: PdfTableDrawOptions = {
  fontSize: PATH_FONT_SIZE,
  headerHeight: getPdfGroupedHeaderHeight(),
  textInsets: LINK_PATH_COLUMNS.map((_, index) => (index === TYPE_COL ? TYPE_TEXT_INSET : 0)),
}

function cellOrDash(value: string | null | undefined): string {
  const t = value?.trim()
  return t || '—'
}

function samePathText(a: string | null | undefined, b: string | null | undefined): boolean {
  return cellOrDash(a).localeCompare(cellOrDash(b), 'es', { sensitivity: 'accent' }) === 0
}

function typeLabel(name: string | null | undefined): string {
  const value = name?.trim()
  return value || 'Sin tipo'
}

function hexToRgb(hex: string | null | undefined): [number, number, number] {
  const value = (hex ?? UNTAGGED_TYPE_COLOR).replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return [59, 130, 246]
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ]
}

function typeStrokeMark(row: {
  linkTypeColor?: string | null
  linkTypeLineStyle?: string | null
}): PdfStrokeMark {
  return {
    rgb: hexToRgb(row.linkTypeColor),
    dash: linkLineStyleDef(row.linkTypeLineStyle).pdfDash,
  }
}

function strokeMarksFor(
  rows: Array<{ linkTypeColor?: string | null; linkTypeLineStyle?: string | null }>,
  colCount: number,
): Array<Array<PdfStrokeMark | null>> {
  return rows.map((row) => {
    const marks: Array<PdfStrokeMark | null> = Array.from({ length: colCount }, () => null)
    marks[TYPE_COL] = typeStrokeMark(row)
    return marks
  })
}

function toClassicCells(row: LinkReferenceRow): string[] {
  return [row.code, typeLabel(row.linkTypeName), row.origin, row.destination, row.description || '—']
}

function toPathCells(row: LinkPathReferenceRow): string[] {
  return [
    row.code,
    typeLabel(row.linkTypeName),
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
 * ID, tipo, puertos y descripción nunca se fusionan. La columna Tipo es la 1.
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
      col: 2,
      isContinuation: (prev, curr) => samePathText(prev.originSite, curr.originSite),
    },
    {
      col: 3,
      isContinuation: (prev, curr) =>
        samePathText(prev.originSite, curr.originSite) &&
        samePathText(prev.originArea, curr.originArea),
    },
    {
      col: 4,
      isContinuation: (prev, curr) =>
        samePathText(prev.originSite, curr.originSite) &&
        samePathText(prev.originArea, curr.originArea) &&
        samePathText(prev.originContainer, curr.originContainer),
    },
    {
      col: 5,
      isContinuation: (prev, curr) =>
        samePathText(prev.originSite, curr.originSite) &&
        samePathText(prev.originArea, curr.originArea) &&
        samePathText(prev.originContainer, curr.originContainer) &&
        samePathText(prev.originDevice, curr.originDevice),
    },
    {
      col: 7,
      isContinuation: (prev, curr) =>
        samePathText(prev.originSite, curr.originSite) &&
        samePathText(prev.originArea, curr.originArea) &&
        samePathText(prev.originContainer, curr.originContainer) &&
        samePathText(prev.originDevice, curr.originDevice) &&
        samePathText(prev.cable, curr.cable),
    },
    {
      col: 9,
      isContinuation: (prev, curr) =>
        samePathText(prev.destinationSite, curr.destinationSite) &&
        samePathText(prev.destinationArea, curr.destinationArea) &&
        samePathText(prev.destinationContainer, curr.destinationContainer) &&
        samePathText(prev.destinationDevice, curr.destinationDevice),
    },
    {
      col: 10,
      isContinuation: (prev, curr) =>
        samePathText(prev.destinationSite, curr.destinationSite) &&
        samePathText(prev.destinationArea, curr.destinationArea) &&
        samePathText(prev.destinationContainer, curr.destinationContainer),
    },
    {
      col: 11,
      isContinuation: (prev, curr) =>
        samePathText(prev.destinationSite, curr.destinationSite) &&
        samePathText(prev.destinationArea, curr.destinationArea),
    },
    {
      col: 12,
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
      PATH_DRAW,
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
    CLASSIC_DRAW,
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
    CLASSIC_DRAW,
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
    const pageRows = pages[i]
    drawPdfTableBody(pdf, geom.table.y, layout, pageRows.map(toClassicCells), undefined, {
      ...CLASSIC_DRAW,
      strokeMarks: strokeMarksFor(pageRows, LINK_REF_COLUMNS.length),
    })
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
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    geom.table.y,
    geom.table.y + geom.table.h,
    LINK_PATH_COLUMNS,
    rows,
    toPathCells,
    PATH_DRAW,
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
      {
        ...PATH_DRAW,
        strokeMarks: strokeMarksFor(pageRows, LINK_PATH_COLUMNS.length),
      },
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
