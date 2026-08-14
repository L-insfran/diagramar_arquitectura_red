import { jsPDF } from 'jspdf'
import {
  appendDiagramPagesAsync,
  countDiagramPdfPages,
  type CapturedDiagram,
} from './pdf/diagramCapturePdf'
import { safePdfFilename, type PdfHeaderBranding } from './pdf/pdfChrome'
import type { PaperFormat, PrintOrientation } from './pdf/a4Geometry'
import {
  countLinkReferencePages,
  drawLinkReferencePages,
  type LinkReferenceRow,
} from './pdf/linkReferencePdf'

export type CaptureConnectionDiagramFn = (
  format: PaperFormat,
  orientation: PrintOrientation,
) => Promise<CapturedDiagram | null>

export type ExportConnectionDiagramOptions = {
  title: string
  subtitle?: string
  projectName?: string
  authorName?: string
  date?: string
  branding?: PdfHeaderBranding
  orientation: PrintOrientation
  format: PaperFormat
  /** Si es false, el PDF no incluye la leyenda. Default true. */
  includeLegend?: boolean
  /** Si es false, el PDF no incluye la tabla de referencia de enlaces. Default true. */
  includeLinkTable?: boolean
  /** Filas de la lista de referencia (ID + descripción completa). */
  linkReferences?: LinkReferenceRow[]
  captureDiagram: CaptureConnectionDiagramFn
}

/**
 * Exporta un PDF profesional del diagrama de conexiones (solo vista diagrama).
 */
export async function exportConnectionDiagramPdf(
  options: ExportConnectionDiagramOptions,
): Promise<void> {
  const {
    title,
    subtitle,
    projectName,
    authorName,
    branding,
    orientation,
    format,
    includeLegend = true,
    includeLinkTable = true,
    linkReferences = [],
    captureDiagram,
  } = options

  const dateStr =
    options.date ??
    new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

  const captured = await captureDiagram(format, orientation)
  if (!captured) {
    throw new Error('No se pudo capturar el diagrama. Agregá al menos un rack o tablero al canvas.')
  }

  const probe = new jsPDF({ orientation, unit: 'mm', format })
  const referencePages = includeLinkTable
    ? countLinkReferencePages(probe, format, orientation, linkReferences)
    : 0
  const totalPages =
    countDiagramPdfPages(captured.plan.cols, captured.plan.rows) + referencePages
  const pdf = new jsPDF({ orientation, unit: 'mm', format })

  const pagesAdded = await appendDiagramPagesAsync(pdf, {
    captured,
    orientation,
    format,
    title,
    subtitle,
    projectName,
    authorName,
    dateStr,
    startingPageNumber: 1,
    totalPages,
    firstPageExists: true,
    branding,
    includeLegend,
  })

  if (includeLinkTable) {
    drawLinkReferencePages(pdf, {
      rows: linkReferences,
      format,
      orientation,
      title,
      projectName,
      authorName,
      dateStr,
      branding,
      startingPageNumber: pagesAdded + 1,
      totalPages,
    })
  }

  const base = safePdfFilename(title) || 'diagrama_conexiones'
  const orientLabel = orientation === 'landscape' ? 'horizontal' : 'vertical'
  pdf.save(`${base}_${format.toUpperCase()}_${orientLabel}.pdf`)
}
