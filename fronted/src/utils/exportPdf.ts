import { jsPDF } from 'jspdf'
import type { TopologyData, TopologyNode, TopologyRackSummary } from '../types'
import type { PrintOrientation } from './printDiagramSectorGrid'
import { getA4Geometry } from './pdf/a4Geometry'
import {
  appendConnectionsTablePages,
  estimateConnectionTablePages,
  type ConnectionTableContext,
  type ConnectionTableSortBy,
} from './pdf/connectionsTablePdf'
import {
  appendDiagramPagesAsync,
  countDiagramPdfPages,
  type CapturedDiagram,
} from './pdf/diagramCapturePdf'
import { drawFooter, drawHeader, safePdfFilename, type PdfHeaderBranding } from './pdf/pdfChrome'
import {
  appendRackElevationPages,
  buildRackElevationModel,
  estimateRackElevationPages,
  type RackElevationModel,
} from './pdf/rackElevationPdf'

export type CaptureDiagramFn = (orientation: PrintOrientation) => Promise<CapturedDiagram | null>

interface ExportOptions {
  title: string
  subtitle?: string
  projectName?: string
  authorName?: string
  date?: string
  /** Branding global (logo + tagline) para el chrome del PDF. */
  branding?: PdfHeaderBranding
  /** Requerido si hay diagrama a capturar (content diagram/full con nodos fuera de rack o sin racks). */
  canvasElement?: HTMLDivElement
  topology: TopologyData
  /** Racks del alcance (para páginas de elevación vectorial). */
  racks?: TopologyRackSummary[]
  /** Cara del rack para elevación. */
  rackFace?: 'front' | 'rear' | 'both'
  /**
   * Captura el diagrama React Flow a escala planificada.
   * Preferido sobre prepareHighResCanvas.
   */
  captureDiagram?: CaptureDiagramFn
  /**
   * @deprecated Preferir `captureDiagram`. Amplía el lienzo antes de rasterizar.
   */
  prepareHighResCanvas?: (orientation: PrintOrientation) => Promise<() => void>
  orientation?: PrintOrientation
  content?: 'table' | 'diagram' | 'full'
  /** Nodos fuera del alcance referenciados por enlaces any-end. */
  externalNodesById?: Map<string, TopologyNode>
  /** Orden de filas en la tabla de conexiones (origen o destino). */
  tableSortBy?: ConnectionTableSortBy
}

export async function exportTopologyPdf(options: ExportOptions): Promise<void> {
  const { title, projectName, authorName, topology, branding } = options
  const content = options.content ?? 'table'
  const orientation: PrintOrientation = options.orientation ?? 'landscape'
  const dateStr =
    options.date ??
    new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
  const racks = options.racks ?? []
  const rackFace = options.rackFace ?? 'both'
  const externalNodesById = options.externalNodesById ?? new Map<string, TopologyNode>()
  const tableSortBy: ConnectionTableSortBy = options.tableSortBy ?? 'source'

  const ctx: ConnectionTableContext = {
    nodes: topology.nodes,
    externalNodesById,
    inScopeNodeIds: new Set(topology.nodes.map((n) => n.id)),
  }

  if (content === 'table') {
    await exportConnectionsOnly({
      title,
      projectName,
      authorName,
      dateStr,
      topology,
      orientation,
      ctx,
      branding,
      tableSortBy,
    })
    return
  }

  await exportFullArchitecturePdf(
    options,
    dateStr,
    orientation,
    content === 'diagram' ? 'diagram' : 'full',
    ctx,
    racks,
    rackFace,
    tableSortBy,
  )
}

async function exportConnectionsOnly(opts: {
  title: string
  projectName?: string
  authorName?: string
  dateStr: string
  topology: TopologyData
  orientation: PrintOrientation
  ctx: ConnectionTableContext
  branding?: PdfHeaderBranding
  tableSortBy: ConnectionTableSortBy
}): Promise<void> {
  const { title, projectName, authorName, dateStr, topology, orientation, ctx, branding, tableSortBy } =
    opts
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const geom = getA4Geometry(orientation)

  if (!topology.edges.length) {
    drawHeader(
      pdf,
      geom.pageW,
      'Tabla de conexiones',
      projectName,
      'Sin conexiones documentadas',
      authorName,
      dateStr,
      branding,
    )
    drawFooter(pdf, geom.pageW, geom.pageH, 1, 1, dateStr, 'Tabla de conexiones')
    const safeName = safePdfFilename(projectName ?? title)
    pdf.save(`${safeName}_Conexiones_${new Date().toISOString().slice(0, 10)}.pdf`)
    return
  }

  const tablePages = estimateConnectionTablePages(pdf, orientation, topology, ctx, tableSortBy)
  appendConnectionsTablePages(pdf, {
    projectName,
    authorName,
    dateStr,
    topology,
    orientation,
    ctx,
    startingPageNumber: 1,
    totalPages: tablePages,
    addPageBeforeEach: false,
    branding,
    tableSortBy,
  })

  const safeName = safePdfFilename(projectName ?? title)
  pdf.save(`${safeName}_Conexiones_${new Date().toISOString().slice(0, 10)}.pdf`)
}

async function exportFullArchitecturePdf(
  options: ExportOptions,
  dateStr: string,
  orientation: PrintOrientation,
  mode: 'diagram' | 'full',
  ctx: ConnectionTableContext,
  racks: TopologyRackSummary[],
  rackFace: 'front' | 'rear' | 'both',
  tableSortBy: ConnectionTableSortBy,
): Promise<void> {
  const { title, subtitle, projectName, authorName, topology, captureDiagram, branding } = options

  const rackModels: RackElevationModel[] = racks.map((rack) =>
    buildRackElevationModel(rack, topology.nodes, rackFace),
  )
  const includeRackPages = rackModels.length > 0
  // Siempre capturar el diagrama cuando el modo lo incluye y hay nodos (no solo si hay sueltos).
  const needCanvasCapture = topology.nodes.length > 0

  const probe = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const rackPageCount = includeRackPages
    ? estimateRackElevationPages(probe, rackModels, orientation)
    : 0

  let captured: CapturedDiagram | null = null
  let diagramPageCount = 0

  if (needCanvasCapture) {
    if (captureDiagram) {
      captured = await captureDiagram(orientation)
    } else if (options.canvasElement && options.prepareHighResCanvas) {
      const { toPng } = await import('html-to-image')
      let restore: (() => void) | undefined
      try {
        restore = await options.prepareHighResCanvas(orientation)
        const viewportEl =
          (options.canvasElement.querySelector('.react-flow__viewport') as HTMLElement | null) ??
          options.canvasElement
        const imgData = await toPng(viewportEl, {
          backgroundColor: '#ffffff',
          pixelRatio: 2,
          filter: (node: Element) => {
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
          },
        })
        const img = new Image()
        img.src = imgData
        await new Promise<void>((r) => {
          img.onload = () => r()
        })
        const { planDiagramPages } = await import('./pdf/diagramScale')
        const plan = planDiagramPages(
          { x: 0, y: 0, width: img.width / 2, height: img.height / 2 },
          orientation,
        )
        captured = { imgData, imgW: img.width, imgH: img.height, plan }
      } finally {
        restore?.()
      }
    }

    if (captured) {
      diagramPageCount = countDiagramPdfPages(captured.plan.cols, captured.plan.rows)
    }
  }

  const includeTable = mode === 'full' && topology.edges.length > 0
  const tablePageCount = includeTable
    ? estimateConnectionTablePages(probe, orientation, topology, ctx, tableSortBy)
    : 0

  const totalPages = Math.max(1, rackPageCount + diagramPageCount + tablePageCount)
  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  // jsPDF siempre crea 1 página vacía. La usamos solo si la primera sección no hace addPage.
  let blankFirstPage = true
  let nextPage = 1

  if (includeRackPages) {
    // append siempre hace addPage → la pág. 1 queda vacía; la borramos al final de esta sección
    const added = appendRackElevationPages(pdf, {
      models: rackModels,
      orientation,
      projectName,
      authorName,
      dateStr,
      title,
      startingPageNumber: nextPage,
      totalPages,
      branding,
    })
    nextPage += added
    if (blankFirstPage && pdf.getNumberOfPages() > added) {
      pdf.deletePage(1)
      blankFirstPage = false
    }
  }

  if (captured) {
    const added = await appendDiagramPagesAsync(pdf, {
      captured,
      orientation,
      title,
      subtitle,
      projectName,
      authorName,
      dateStr,
      startingPageNumber: nextPage,
      totalPages,
      firstPageExists: blankFirstPage,
      branding,
    })
    nextPage += added
    blankFirstPage = false
  }

  if (includeTable) {
    appendConnectionsTablePages(pdf, {
      projectName,
      authorName,
      dateStr,
      topology,
      orientation,
      ctx,
      startingPageNumber: nextPage,
      totalPages,
      addPageBeforeEach: !blankFirstPage,
      branding,
      tableSortBy,
    })
    blankFirstPage = false
  }

  if (blankFirstPage) {
    const geom = getA4Geometry(orientation)
    drawHeader(
      pdf,
      geom.pageW,
      title,
      projectName,
      subtitle ?? 'Sin contenido en el alcance',
      authorName,
      dateStr,
      branding,
    )
    drawFooter(pdf, geom.pageW, geom.pageH, 1, 1, dateStr, 'Vacío')
  }

  const safeName = safePdfFilename(projectName ?? title)
  const suffix = mode === 'diagram' ? 'Diagrama' : 'Arquitectura'
  pdf.save(`${safeName}_${suffix}_${new Date().toISOString().slice(0, 10)}.pdf`)
}
