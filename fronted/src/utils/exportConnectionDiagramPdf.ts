import { jsPDF } from 'jspdf'
import {
  appendDiagramPagesAsync,
  countDiagramPdfPages,
  type CapturedDiagram,
} from './pdf/diagramCapturePdf'
import { safePdfFilename, invertLogoForPrint, type PdfHeaderBranding } from './pdf/pdfChrome'
import type { PaperFormat, PrintOrientation } from './pdf/a4Geometry'
import {
  countLinkReferencePages,
  drawLinkReferencePages,
  type LinkPathReferenceRow,
  type LinkReferenceRow,
  type LinkTableFormat,
} from './pdf/linkReferencePdf'

export type CaptureConnectionDiagramFn = (
  format: PaperFormat,
  orientation: PrintOrientation,
) => Promise<CapturedDiagram | null>

export type ExportConnectionDiagramOptions = {
  title: string
  subtitle?: string
  projectName?: string
  clientName?: string
  authorName?: string
  date?: string
  branding?: PdfHeaderBranding
  orientation: PrintOrientation
  format: PaperFormat
  /** Si es false, el PDF no incluye la leyenda. Default true. */
  includeLegend?: boolean
  /** Si es false, el PDF no incluye la tabla de referencia de enlaces. Default true. */
  includeLinkTable?: boolean
  /** Formato de la tabla de enlaces. Default `table`. */
  linkTableFormat?: LinkTableFormat
  /** Encabezado y diagrama claros para impresión B/N. */
  invertColors?: boolean
  /** Filas clásicas (ID + origen/destino en path). */
  linkReferences?: LinkReferenceRow[]
  /** Filas de ruta lineal (segmentos por columna). */
  linkPathReferences?: LinkPathReferenceRow[]
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
    clientName,
    authorName,
    branding,
    orientation,
    format,
    includeLegend = true,
    includeLinkTable = true,
    linkTableFormat = 'table',
    invertColors = false,
    linkReferences = [],
    linkPathReferences = [],
    captureDiagram,
  } = options

  const dateStr =
    options.date ??
    new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

  let printBranding = branding
  if (invertColors && branding?.logoDataUrl) {
    printBranding = {
      ...branding,
      logoDataUrl: await invertLogoForPrint(branding.logoDataUrl),
    }
  }

  const captured = await captureDiagram(format, orientation)
  if (!captured) {
    throw new Error('No se pudo capturar el diagrama. Agregá al menos un rack o tablero al canvas.')
  }

  const probe = new jsPDF({ orientation, unit: 'mm', format })
  const referencePages = includeLinkTable
    ? countLinkReferencePages(
        probe,
        format,
        orientation,
        linkReferences,
        linkTableFormat,
        linkPathReferences,
      )
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
    clientName,
    authorName,
    dateStr,
    startingPageNumber: 1,
    totalPages,
    firstPageExists: true,
    branding: printBranding,
    includeLegend,
    invertColors,
  })

  if (includeLinkTable) {
    drawLinkReferencePages(pdf, {
      rows: linkReferences,
      pathRows: linkPathReferences,
      linkFormat: linkTableFormat,
      format,
      orientation,
      title,
      projectName,
      clientName,
      authorName,
      dateStr,
      branding: printBranding,
      startingPageNumber: pagesAdded + 1,
      totalPages,
      invertColors,
    })
  }

  const base = safePdfFilename(title) || 'diagrama_conexiones'
  const orientLabel = orientation === 'landscape' ? 'horizontal' : 'vertical'
  pdf.save(`${base}_${format.toUpperCase()}_${orientLabel}.pdf`)
}

export type { LinkTableFormat, LinkPathReferenceRow, LinkReferenceRow }
