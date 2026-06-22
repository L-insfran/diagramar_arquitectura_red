import { toPng } from 'html-to-image'
import { jsPDF } from 'jspdf'
import type { TopologyData, TopologyNode } from '../types'
import { formatMediumLabel, CONNECTION_STATUS_LABELS, MEDIUM_LABELS } from '../types'
import {
  computeTileGrid,
  getA4DiagramUsableMm,
  MARGIN,
  HEADER_H,
  FOOTER_H,
  LEGEND_H,
  type PrintOrientation,
} from './printDiagramSectorGrid'

interface ExportOptions {
  title: string
  subtitle?: string
  companyName?: string
  authorName?: string
  date?: string
  canvasElement: HTMLDivElement
  topology: TopologyData
  /**
   * Si se define, se ejecuta antes de rasterizar: p. ej. ampliar el lienzo React Flow
   * para que el PNG tenga más resolución por nodo. Debe devolver `restore` para dejar la UI como estaba.
   */
  prepareHighResCanvas?: (orientation: PrintOrientation) => Promise<() => void>
  /** Orientación del PDF. Default: 'landscape'. */
  orientation?: PrintOrientation
}

function resolveNodeLabel(nodes: TopologyNode[], id: string): string {
  return nodes.find((n) => n.id === id)?.label ?? 'Desconocido'
}

function resolveNodeHostname(nodes: TopologyNode[], id: string): string | null {
  const raw = nodes.find((n) => n.id === id)?.data?.hostname
  const s = typeof raw === 'string' ? raw.trim() : raw
  return s && s.length > 0 ? s : null
}

function resolveNodeLocation(nodes: TopologyNode[], id: string): string | null {
  const raw = nodes.find((n) => n.id === id)?.data?.location
  const s = typeof raw === 'string' ? raw.trim() : raw
  return s && s.length > 0 ? s : null
}

function resolveNodeDisplay(nodes: TopologyNode[], id: string): string {
  const label = resolveNodeLabel(nodes, id)
  const host = resolveNodeHostname(nodes, id)
  return host ? `${label} (${host})` : label
}

export async function exportTopologyPdf(options: ExportOptions): Promise<void> {
  const { title, subtitle, companyName, authorName, canvasElement, topology, prepareHighResCanvas } = options
  const orientation: PrintOrientation = options.orientation ?? 'landscape'
  const dateStr = options.date ?? new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })

  let restoreCanvas: (() => void) | undefined
  if (prepareHighResCanvas) {
    try {
      restoreCanvas = await prepareHighResCanvas(orientation)
    } catch (e) {
      console.warn('prepareHighResCanvas falló, se exporta con el tamaño actual del lienzo', e)
    }
  }

  const viewportEl = canvasElement.querySelector('.react-flow__viewport') as HTMLElement | null
  const targetEl = viewportEl ?? canvasElement

  const originalBg = targetEl.style.backgroundColor
  targetEl.style.backgroundColor = '#ffffff'

  const approxCssPixels = Math.max(1, targetEl.offsetWidth * targetEl.offsetHeight)
  const pixelRatio = approxCssPixels * 9 > 28_000_000 ? 2 : 3

  let imgData: string
  try {
    imgData = await toPng(targetEl, {
      backgroundColor: '#ffffff',
      pixelRatio,
      filter: (node: Element) => {
        if (node instanceof HTMLElement) {
          const cl = node.classList
          if (cl.contains('react-flow__controls') || cl.contains('react-flow__minimap') ||
              cl.contains('react-flow__panel') || cl.contains('react-flow__attribution')) return false
        }
        return true
      },
    })
  } finally {
    targetEl.style.backgroundColor = originalBg
    restoreCanvas?.()
  }

  const img = new Image()
  img.src = imgData
  await new Promise<void>((resolve) => { img.onload = () => resolve() })

  const imgW = img.width
  const imgH = img.height

  const pdf = new jsPDF({ orientation, unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()

  const { usableW, usableH } = getA4DiagramUsableMm(orientation)

  const { cols, rows } = computeTileGrid(imgW, imgH, usableW, usableH)
  const totalDiagramPages = cols * rows
  const hasTable = topology.edges.length > 0
  const tablePages = hasTable ? Math.ceil(topology.edges.length / 25) : 0
  const totalPages = 1 + totalDiagramPages + tablePages

  // --- Page 1: Cover / overview ---
  drawHeader(pdf, pageW, title, companyName, subtitle, authorName, dateStr)

  const overviewMaxH = usableH
  const imgAspect = imgW / imgH
  let drawW = usableW
  let drawH = drawW / imgAspect
  if (drawH > overviewMaxH) { drawH = overviewMaxH; drawW = drawH * imgAspect }
  const drawX = MARGIN + (usableW - drawW) / 2
  const drawY = HEADER_H + 2 + (overviewMaxH - drawH) / 2
  pdf.addImage(imgData, 'PNG', drawX, drawY, drawW, drawH)

  drawLegend(pdf, pageW, pageH)
  drawFooter(pdf, pageW, pageH, 1, totalPages, dateStr, 'Vista general')

  if (totalDiagramPages > 1) {
    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'italic')
    pdf.setTextColor(120, 120, 120)
    pdf.text(
      `El diagrama se divide en ${totalDiagramPages} sectores (${cols}×${rows}) a tamaño legible. Cada página siguiente muestra un sector ampliado a ancho útil.`,
      MARGIN,
      pageH - FOOTER_H - LEGEND_H - 8,
      { maxWidth: pageW - MARGIN * 2 }
    )
  }

  // --- Pages 2..N: Tiled sectors ---
  const tileW = imgW / cols
  const tileH = imgH / rows

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      pdf.addPage('a4', orientation)
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      const sectorNum = row * cols + col + 1
      const sectorLabel = `Sector ${sectorNum} de ${totalDiagramPages} (fila ${row + 1}, columna ${col + 1})`

      drawSectorHeader(pdf, pw, title, companyName, sectorLabel)

      const sectorUsableW = pw - MARGIN * 2
      const sectorUsableH = ph - 30 - FOOTER_H - 4

      const sx = col * tileW
      const sy = row * tileH
      const sw = tileW
      const sh = tileH

      const sectorCanvas = document.createElement('canvas')
      sectorCanvas.width = Math.ceil(sw)
      sectorCanvas.height = Math.ceil(sh)
      const ctx = sectorCanvas.getContext('2d')!
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, sectorCanvas.width, sectorCanvas.height)
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sectorCanvas.width, sectorCanvas.height)
      const sectorImg = sectorCanvas.toDataURL('image/png')

      const sectorAspect = sw / sh
      let sDrawW = sectorUsableW
      let sDrawH = sDrawW / sectorAspect
      if (sDrawH > sectorUsableH) { sDrawH = sectorUsableH; sDrawW = sDrawH * sectorAspect }
      const sDrawX = MARGIN + (sectorUsableW - sDrawW) / 2
      const sDrawY = 30 + (sectorUsableH - sDrawH) / 2
      pdf.addImage(sectorImg, 'PNG', sDrawX, sDrawY, sDrawW, sDrawH)

      drawGridIndicator(pdf, pw, ph, cols, rows, col, row)
      drawFooter(pdf, pw, ph, 1 + sectorNum, totalPages, dateStr, sectorLabel)
    }
  }

  // --- Table pages ---
  if (hasTable) {
    const rowsPerPage = 25
    const edgeChunks = chunkArray(topology.edges, rowsPerPage)
    for (let ci = 0; ci < edgeChunks.length; ci++) {
      pdf.addPage('a4', orientation)
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      const pageLabel = edgeChunks.length > 1 ? `Tabla de conexiones (${ci + 1}/${edgeChunks.length})` : 'Tabla de conexiones'
      drawHeader(pdf, pw, pageLabel, companyName, `${topology.edges.length} conexiones documentadas`, authorName, dateStr)
      drawConnectionsTable(pdf, pw, ph, topology.nodes, edgeChunks[ci], ci === 0)

      if (ci === edgeChunks.length - 1) {
        drawSummary(pdf, pw, ph, topology)
      }

      drawFooter(pdf, pw, ph, 1 + totalDiagramPages + ci + 1, totalPages, dateStr, pageLabel)
    }
  }

  const safeName = (companyName ?? title).replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '_')
  pdf.save(`${safeName}_Arquitectura_${new Date().toISOString().slice(0, 10)}.pdf`)
}

function drawHeader(pdf: jsPDF, pageW: number, title: string, companyName: string | undefined, subtitle: string | undefined, authorName: string | undefined, dateStr: string) {
  pdf.setFillColor(15, 23, 42)
  pdf.rect(0, 0, pageW, HEADER_H - 4, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')

  if (companyName) {
    pdf.text(companyName, MARGIN, 13)
    pdf.setFontSize(10)
    pdf.setFont('helvetica', 'normal')
    pdf.text(title, MARGIN, 21)
  } else {
    pdf.text(title, MARGIN, 15)
  }

  if (subtitle) {
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(200, 200, 200)
    pdf.text(subtitle, MARGIN, companyName ? 28 : 24)
  }

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.text(dateStr, pageW - MARGIN, 13, { align: 'right' })

  if (authorName) {
    pdf.setFontSize(7)
    pdf.text(`Generado por: ${authorName}`, pageW - MARGIN, 20, { align: 'right' })
  }

  pdf.setDrawColor(59, 130, 246)
  pdf.setLineWidth(0.6)
  pdf.line(0, HEADER_H - 4, pageW, HEADER_H - 4)
}

function drawSectorHeader(pdf: jsPDF, pageW: number, title: string, companyName: string | undefined, sectorLabel: string) {
  pdf.setFillColor(30, 41, 59)
  pdf.rect(0, 0, pageW, 24, 'F')

  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(9)
  pdf.setFont('helvetica', 'bold')
  pdf.text(companyName ? `${companyName} — ${title}` : title, MARGIN, 10)

  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(180, 190, 210)
  pdf.text(sectorLabel, MARGIN, 17)

  pdf.setDrawColor(59, 130, 246)
  pdf.setLineWidth(0.4)
  pdf.line(0, 24, pageW, 24)
}

function drawGridIndicator(pdf: jsPDF, pageW: number, _pageH: number, cols: number, rows: number, activeCol: number, activeRow: number) {
  const cellSize = 6
  const gap = 1.5
  const gridW = cols * (cellSize + gap) - gap
  const startX = pageW - MARGIN - gridW
  const startY = 26

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = startX + c * (cellSize + gap)
      const y = startY + r * (cellSize + gap)
      if (r === activeRow && c === activeCol) {
        pdf.setFillColor(59, 130, 246)
        pdf.rect(x, y, cellSize, cellSize, 'F')
      } else {
        pdf.setFillColor(226, 232, 240)
        pdf.rect(x, y, cellSize, cellSize, 'F')
      }
    }
  }
}

function drawLegend(pdf: jsPDF, _pageW: number, pageH: number) {
  const legendY = pageH - FOOTER_H - 6
  pdf.setFontSize(6)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(100, 100, 100)
  pdf.text('LEYENDA:', MARGIN, legendY)

  const items = [
    { color: [59, 130, 246] as [number, number, number], label: 'Cable UTP', dash: false },
    { color: [249, 115, 22] as [number, number, number], label: 'Fibra óptica', dash: false },
    { color: [34, 197, 94] as [number, number, number], label: 'WiFi', dash: true },
  ]

  let x = MARGIN + 17
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(6)
  for (const item of items) {
    pdf.setDrawColor(item.color[0], item.color[1], item.color[2])
    pdf.setLineWidth(0.8)
    if (item.dash) {
      for (let dx = 0; dx < 8; dx += 3) pdf.line(x + dx, legendY - 1.2, x + dx + 1.5, legendY - 1.2)
    } else {
      pdf.line(x, legendY - 1.2, x + 8, legendY - 1.2)
    }
    pdf.setTextColor(80, 80, 80)
    pdf.text(item.label, x + 11, legendY)
    x += 32
  }

  x += 4
  const statusItems = [
    { color: [250, 204, 21] as [number, number, number], label: 'Planificada' },
    { color: [96, 165, 250] as [number, number, number], label: 'Implementada' },
    { color: [52, 211, 153] as [number, number, number], label: 'Verificada' },
  ]
  for (const item of statusItems) {
    pdf.setFillColor(item.color[0], item.color[1], item.color[2])
    pdf.circle(x + 1, legendY - 1.2, 1, 'F')
    pdf.setTextColor(80, 80, 80)
    pdf.text(item.label, x + 4, legendY)
    x += 24
  }
}

function drawFooter(pdf: jsPDF, pageW: number, pageH: number, page: number, total: number, _dateStr: string, sectionLabel?: string) {
  const y = pageH - 6
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.2)
  pdf.line(MARGIN, y - 4, pageW - MARGIN, y - 4)

  pdf.setFontSize(6)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(150, 150, 150)
  pdf.text('Network Architecture Documenter', MARGIN, y)
  if (sectionLabel) {
    pdf.text(sectionLabel, pageW / 2, y, { align: 'center' })
  }
  pdf.text(`Página ${page} de ${total}`, pageW - MARGIN, y, { align: 'right' })
}

function drawConnectionsTable(pdf: jsPDF, pageW: number, _pageH: number, nodes: TopologyNode[], edges: TopologyData['edges'], _isFirst: boolean) {
  const startY = HEADER_H + 2
  const availW = pageW - MARGIN * 2
  const proportions = [0.16, 0.16, 0.1, 0.1, 0.18, 0.1, 0.08, 0.12]
  const colWidths = proportions.map((p) => p * availW)
  const headers = ['Origen', 'Destino', 'Pto. Origen', 'Pto. Destino', 'Medio', 'Velocidad', 'Estado', 'Ubicación']
  const tableW = colWidths.reduce((a, b) => a + b, 0)
  const startX = MARGIN + (availW - tableW) / 2

  pdf.setFillColor(15, 23, 42)
  pdf.rect(startX, startY, tableW, 7, 'F')
  pdf.setFontSize(6)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)

  let cx = startX
  for (let i = 0; i < headers.length; i++) {
    pdf.text(headers[i], cx + 2, startY + 4.6)
    cx += colWidths[i]
  }

  let y = startY + 7
  const rowH = 6
  const maxChars = colWidths.map((w) => Math.max(8, Math.floor(w / 1.5)))

  for (let ei = 0; ei < edges.length; ei++) {
    const edge = edges[ei]
    const srcLoc = resolveNodeLocation(nodes, edge.source)
    const tgtLoc = resolveNodeLocation(nodes, edge.target)
    const location =
      srcLoc && tgtLoc
        ? (srcLoc === tgtLoc ? srcLoc : `${srcLoc} → ${tgtLoc}`)
        : (srcLoc ?? tgtLoc ?? '—')
    const row = [
      resolveNodeDisplay(nodes, edge.source),
      resolveNodeDisplay(nodes, edge.target),
      edge.sourcePort,
      edge.targetPort,
      edge.medium ? formatMediumLabel(edge.medium) : 'N/A',
      edge.bandwidth ?? '—',
      CONNECTION_STATUS_LABELS[edge.connectionStatus] ?? edge.connectionStatus,
      location,
    ]

    if (ei % 2 === 0) {
      pdf.setFillColor(248, 250, 252)
      pdf.rect(startX, y, tableW, rowH, 'F')
    }

    cx = startX
    pdf.setFontSize(5.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(30, 41, 59)
    for (let i = 0; i < row.length; i++) {
      const limit = maxChars[i]
      const text = row[i].length > limit ? row[i].substring(0, limit - 1) + '…' : row[i]
      pdf.text(text, cx + 2, y + 3.8)
      cx += colWidths[i]
    }
    y += rowH
  }

  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.2)
  pdf.rect(startX, startY, tableW, y - startY)
  cx = startX
  for (let i = 0; i < colWidths.length - 1; i++) {
    cx += colWidths[i]
    pdf.line(cx, startY, cx, y)
  }
}

function drawSummary(pdf: jsPDF, _pageW: number, pageH: number, topology: TopologyData) {
  const summaryY = pageH - FOOTER_H - 18
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

  for (const [mt, count] of Object.entries(mediumCounts)) {
    pdf.text(`${MEDIUM_LABELS[mt as keyof typeof MEDIUM_LABELS] ?? mt}: ${count}`, sx, summaryY + 5)
    sx += 32
  }
  for (const [st, count] of Object.entries(statusCounts)) {
    pdf.text(`${CONNECTION_STATUS_LABELS[st as keyof typeof CONNECTION_STATUS_LABELS] ?? st}: ${count}`, sx, summaryY + 5)
    sx += 28
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}
