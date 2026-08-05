import type { jsPDF } from 'jspdf'
import type { TopologyData, TopologyNode } from '../../types'
import { formatMediumLabel, CONNECTION_STATUS_LABELS, MEDIUM_LABELS } from '../../types'
import { getA4Geometry, MARGIN, type PrintOrientation } from './a4Geometry'
import { drawFooter, drawHeader, type PdfHeaderBranding } from './pdfChrome'
import {
  drawPdfTableBody,
  drawPdfTableHeader,
  getPdfTableLayout,
  paginatePdfRows,
  type PdfTableColumn,
} from './pdfTable'

const CONNECTION_COLUMNS: PdfTableColumn[] = [
  { header: 'Origen', proportion: 0.22 },
  { header: 'Pto. Ori.', proportion: 0.09 },
  { header: 'Destino', proportion: 0.22 },
  { header: 'Pto. Dest.', proportion: 0.09 },
  { header: 'Medio', proportion: 0.14 },
  { header: 'Red', proportion: 0.12 },
  { header: 'VLANs', proportion: 0.12 },
]

export type ConnectionTableContext = {
  nodes: TopologyNode[]
  /** Nodos fuera del alcance (solo para etiquetas de extremos externos). */
  externalNodesById?: Map<string, TopologyNode>
  /** IDs de nodos dentro del alcance. */
  inScopeNodeIds?: Set<string>
}

function resolveNodeLabel(ctx: ConnectionTableContext, id: string): string {
  const inScope = ctx.nodes.find((n) => n.id === id)
  if (inScope) return inScope.label
  const ext = ctx.externalNodesById?.get(id)
  return ext?.label ?? 'Desconocido'
}

function resolveNodeHostname(ctx: ConnectionTableContext, id: string): string | null {
  const node = ctx.nodes.find((n) => n.id === id) ?? ctx.externalNodesById?.get(id)
  const raw = node?.data?.hostname
  const s = typeof raw === 'string' ? raw.trim() : raw
  return s && s.length > 0 ? s : null
}

function resolveNodeTemplateName(ctx: ConnectionTableContext, id: string): string | null {
  const node = ctx.nodes.find((n) => n.id === id) ?? ctx.externalNodesById?.get(id)
  const raw = node?.data?.templateName
  const s = typeof raw === 'string' ? raw.trim() : raw
  return s && s.length > 0 ? s : null
}

function resolveNodeDisplay(ctx: ConnectionTableContext, id: string): { text: string; external: boolean } {
  const external = !!(ctx.inScopeNodeIds && !ctx.inScopeNodeIds.has(id))
  const label = resolveNodeLabel(ctx, id)
  const templateName = resolveNodeTemplateName(ctx, id)
  const host = resolveNodeHostname(ctx, id)
  const secondary = templateName ?? host
  const base = secondary ? `${label} (${secondary})` : label
  return {
    text: external ? `${base} (fuera del alcance)` : base,
    external,
  }
}

function formatEdgeVlansForPdf(edge: TopologyData['edges'][number]): string {
  if (edge.vlanLabel) return edge.vlanLabel
  const vlans = edge.vlans ?? []
  if (!vlans.length) return '—'
  if (edge.portRole === 'trunk' && vlans.length > 1) return `Trunk · ${vlans.length} VLANs`
  return vlans.map((v) => `VLAN ${v.vlanId}`).join(', ')
}

function formatEdgeNetworksForPdf(edge: TopologyData['edges'][number]): string {
  if (edge.networkLabel) return edge.networkLabel
  const networks = edge.networks ?? []
  if (!networks.length) return '—'
  return networks.map((n) => n.subnet || n.name).join(', ')
}

export function buildConnectionRow(
  ctx: ConnectionTableContext,
  edge: TopologyData['edges'][number],
): { cells: string[]; colors: Array<[number, number, number] | null> } {
  const source = resolveNodeDisplay(ctx, edge.source)
  const target = resolveNodeDisplay(ctx, edge.target)
  const gray: [number, number, number] = [100, 116, 139]
  return {
    cells: [
      source.text,
      edge.sourcePort || '—',
      target.text,
      edge.targetPort || '—',
      edge.medium ? formatMediumLabel(edge.medium) : '—',
      formatEdgeNetworksForPdf(edge),
      formatEdgeVlansForPdf(edge),
    ],
    colors: [
      source.external ? gray : null,
      null,
      target.external ? gray : null,
      null,
      null,
      null,
      null,
    ],
  }
}

export type ConnectionTableSortBy = 'source' | 'target'

const LOCALE_COMPARE_OPTS: Intl.CollatorOptions = { sensitivity: 'base', numeric: true }

function compareLabel(a: string, b: string): number {
  return a.localeCompare(b, 'es', LOCALE_COMPARE_OPTS)
}

/**
 * Ordena edges por equipo (origen o destino), luego puerto, luego el otro extremo.
 * Usa el label del nodo (sin sufijo «fuera del alcance») para agrupar equipos iguales.
 */
export function sortConnectionEdges(
  edges: TopologyData['edges'],
  ctx: ConnectionTableContext,
  sortBy: ConnectionTableSortBy = 'source',
): TopologyData['edges'] {
  return [...edges].sort((a, b) => {
    const aPrimaryId = sortBy === 'source' ? a.source : a.target
    const bPrimaryId = sortBy === 'source' ? b.source : b.target
    const aPrimaryPort = sortBy === 'source' ? a.sourcePort : a.targetPort
    const bPrimaryPort = sortBy === 'source' ? b.sourcePort : b.targetPort
    const aOtherId = sortBy === 'source' ? a.target : a.source
    const bOtherId = sortBy === 'source' ? b.target : b.source
    const aOtherPort = sortBy === 'source' ? a.targetPort : a.sourcePort
    const bOtherPort = sortBy === 'source' ? b.targetPort : b.sourcePort

    const byDevice = compareLabel(resolveNodeLabel(ctx, aPrimaryId), resolveNodeLabel(ctx, bPrimaryId))
    if (byDevice !== 0) return byDevice

    const byPort = compareLabel(aPrimaryPort || '', bPrimaryPort || '')
    if (byPort !== 0) return byPort

    const byOther = compareLabel(resolveNodeLabel(ctx, aOtherId), resolveNodeLabel(ctx, bOtherId))
    if (byOther !== 0) return byOther

    return compareLabel(aOtherPort || '', bOtherPort || '')
  })
}

function drawSummary(
  pdf: jsPDF,
  pageH: number,
  topology: TopologyData,
  externalCount: number,
) {
  const summaryY = pageH - 16 - 18
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(51, 65, 85)
  pdf.text('Resumen', MARGIN, summaryY)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)

  const mediumCounts: Record<string, number> = {}
  const statusCounts: Record<string, number> = {}
  for (const edge of topology.edges) {
    const mt = edge.medium?.mediumType ?? 'utp'
    mediumCounts[mt] = (mediumCounts[mt] || 0) + 1
    const st = edge.connectionStatus ?? 'implemented'
    statusCounts[st] = (statusCounts[st] || 0) + 1
  }

  let sx = MARGIN
  pdf.text(`Total: ${topology.edges.length} conexiones`, sx, summaryY + 5)
  sx += 42
  if (externalCount > 0) {
    pdf.setTextColor(100, 116, 139)
    pdf.text(`Hacia el exterior: ${externalCount}`, sx, summaryY + 5)
    pdf.setTextColor(51, 65, 85)
    sx += 40
  }

  for (const [mt, count] of Object.entries(mediumCounts)) {
    pdf.text(`${MEDIUM_LABELS[mt as keyof typeof MEDIUM_LABELS] ?? mt}: ${count}`, sx, summaryY + 5)
    sx += 32
  }
  for (const [st, count] of Object.entries(statusCounts)) {
    pdf.text(`${CONNECTION_STATUS_LABELS[st as keyof typeof CONNECTION_STATUS_LABELS] ?? st}: ${count}`, sx, summaryY + 5)
    sx += 28
  }
}

export function countExternalEdges(
  edges: TopologyData['edges'],
  inScopeNodeIds: Set<string>,
): number {
  return edges.filter(
    (e) => !inScopeNodeIds.has(e.source) || !inScopeNodeIds.has(e.target),
  ).length
}

/**
 * Dibuja páginas de tabla de conexiones en un PDF ya creado.
 * Devuelve la cantidad de páginas añadidas.
 */
export function appendConnectionsTablePages(
  pdf: jsPDF,
  opts: {
    title?: string
    projectName?: string
    authorName?: string
    dateStr: string
    topology: TopologyData
    orientation: PrintOrientation
    ctx: ConnectionTableContext
    startingPageNumber: number
    totalPages: number
    addPageBeforeEach?: boolean
    branding?: PdfHeaderBranding
    tableSortBy?: ConnectionTableSortBy
  },
): number {
  const {
    projectName,
    authorName,
    dateStr,
    topology,
    orientation,
    ctx,
    startingPageNumber,
    totalPages,
    branding,
  } = opts
  const edges = sortConnectionEdges(topology.edges, ctx, opts.tableSortBy ?? 'source')
  if (!edges.length) return 0

  const geom = getA4Geometry(orientation)
  const bodyStart = geom.table.y
  const maxY = geom.table.y + geom.table.h
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    bodyStart,
    maxY,
    CONNECTION_COLUMNS,
    edges,
    (edge) => buildConnectionRow(ctx, edge).cells,
  )

  const inScope = ctx.inScopeNodeIds ?? new Set(ctx.nodes.map((n) => n.id))
  const externalCount = countExternalEdges(edges, inScope)

  for (let ci = 0; ci < pages.length; ci++) {
    // addPageBeforeEach=false: reutilizar la página actual solo en la primera iteración
    const reuseFirstPage = ci === 0 && opts.addPageBeforeEach === false
    if (!reuseFirstPage) {
      pdf.addPage('a4', orientation)
    }

    const pw = pdf.internal.pageSize.getWidth()
    const ph = pdf.internal.pageSize.getHeight()
    const pageLabel =
      pages.length > 1 ? `Tabla de conexiones (${ci + 1}/${pages.length})` : 'Tabla de conexiones'
    drawHeader(
      pdf,
      pw,
      pageLabel,
      projectName,
      `${edges.length} conexiones documentadas${externalCount > 0 ? ` · ${externalCount} hacia el exterior` : ''}`,
      authorName,
      dateStr,
      branding,
    )

    const layout = getPdfTableLayout(pw, CONNECTION_COLUMNS)
    drawPdfTableHeader(pdf, bodyStart, layout, CONNECTION_COLUMNS)

    const pageEdges = pages[ci]
    const rows = pageEdges.map((edge) => buildConnectionRow(ctx, edge))
    drawPdfTableBody(
      pdf,
      bodyStart,
      layout,
      rows.map((r) => r.cells),
      rows.map((r) => r.colors),
    )

    if (ci === pages.length - 1) {
      drawSummary(pdf, ph, topology, externalCount)
    }

    drawFooter(pdf, pw, ph, startingPageNumber + ci, totalPages, dateStr, pageLabel)
  }

  return pages.length
}

export function estimateConnectionTablePages(
  pdf: jsPDF,
  orientation: PrintOrientation,
  topology: TopologyData,
  ctx: ConnectionTableContext,
  tableSortBy: ConnectionTableSortBy = 'source',
): number {
  if (!topology.edges.length) return 0
  const edges = sortConnectionEdges(topology.edges, ctx, tableSortBy)
  const geom = getA4Geometry(orientation)
  const pages = paginatePdfRows(
    pdf,
    geom.pageW,
    geom.table.y,
    geom.table.y + geom.table.h,
    CONNECTION_COLUMNS,
    edges,
    (edge) => buildConnectionRow(ctx, edge).cells,
  )
  return pages.length
}

export { CONNECTION_COLUMNS }
