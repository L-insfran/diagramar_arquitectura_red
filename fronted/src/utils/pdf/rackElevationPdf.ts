import type { jsPDF } from 'jspdf'
import type {
  DeviceRackFace,
  TopologyNode,
  TopologyRackAccessory,
  TopologyRackSummary,
} from '../../types'
import { getA4Geometry, type PrintOrientation } from './a4Geometry'
import { drawFooter, drawHeader, type PdfHeaderBranding } from './pdfChrome'
import {
  drawPdfTableBody,
  drawPdfTableHeader,
  getPdfTableLayout,
  paginatePdfRows,
  type PdfTableColumn,
} from './pdfTable'

export type RackElevationDevice = {
  id: string
  label: string
  hostname: string | null
  ipAddress: string | null
  manufacturer: string | null
  model: string | null
  unitStart: number
  heightU: number
  unitEnd: number
  face: DeviceRackFace
  isFullDepth: boolean
  onShelf: boolean
  portCount: number
}

export type RackElevationModel = {
  rack: TopologyRackSummary
  devices: RackElevationDevice[]
  accessories: TopologyRackAccessory[]
  usedU: number
  freeU: number
  percentUsed: number
  face: 'front' | 'rear' | 'both'
}

const DEVICE_COLORS: Array<[number, number, number]> = [
  [37, 99, 235],
  [124, 58, 237],
  [234, 88, 12],
  [5, 150, 105],
  [219, 39, 119],
  [8, 145, 178],
  [180, 83, 9],
  [67, 56, 202],
]

function normalizeFace(face: string | null | undefined): DeviceRackFace {
  return face === 'rear' ? 'rear' : 'front'
}

function deviceHeightU(node: TopologyNode): number {
  if (node.data.supportedByAccessoryId) {
    return Math.max(1, Math.round(node.data.shelfHeightU ?? node.data.rackUnits ?? 1))
  }
  return Math.max(1, Math.round(node.data.rackUnits ?? 1))
}

/**
 * Construye el modelo de elevación de un rack a partir de nodos de topología.
 */
export function buildRackElevationModel(
  rack: TopologyRackSummary,
  nodes: TopologyNode[],
  face: 'front' | 'rear' | 'both' = 'both',
): RackElevationModel {
  const accessories = rack.accessories ?? []
  const accessoriesById = new Map(accessories.map((a) => [a.id, a]))

  const devices: RackElevationDevice[] = []
  for (const node of nodes) {
    const shelfId = node.data.supportedByAccessoryId ?? null
    const shelf = shelfId ? accessoriesById.get(shelfId) : undefined
    const onThisRack =
      node.data.rackId === rack.id || (!!shelf && accessoriesById.has(shelf.id))
    if (!onThisRack) continue

    // Equipos en bandeja: la U viene del accesorio (como en el canvas), no de rackUnitStart
    // (que suele ser null → caía erróneamente en U1).
    const unitStart = Math.max(
      1,
      Math.round(shelf ? shelf.unitStart : (node.data.rackUnitStart ?? 1)),
    )
    const heightU = deviceHeightU(node)
    const isFullDepth = !!node.data.isFullDepth || node.data.rackFace === 'both'
    const deviceFace = isFullDepth ? 'front' : normalizeFace(node.data.rackFace)

    if (face !== 'both' && !isFullDepth && deviceFace !== face) continue

    devices.push({
      id: node.id,
      label: node.label,
      hostname: node.data.hostname,
      ipAddress: node.data.ipAddress,
      manufacturer: node.data.manufacturer ?? null,
      model: node.data.model ?? null,
      unitStart,
      heightU,
      unitEnd: unitStart + heightU - 1,
      face: isFullDepth ? 'front' : deviceFace,
      isFullDepth,
      onShelf: !!shelf,
      portCount: node.data.ports?.length ?? 0,
    })
  }

  devices.sort((a, b) => b.unitStart - a.unitStart || a.label.localeCompare(b.label))

  // Ocupación: U únicas cubiertas (front+rear full-depth cuenta 1).
  const covered = new Set<number>()
  for (const d of devices) {
    for (let u = d.unitStart; u <= d.unitEnd; u++) covered.add(u)
  }
  // Contar también las U de bandejas (ocupan espacio aunque no haya equipo encima).
  for (const acc of accessories) {
    for (let u = acc.unitStart; u < acc.unitStart + acc.heightU; u++) covered.add(u)
  }
  const usedU = covered.size
  const freeU = Math.max(0, rack.heightU - usedU)
  const percentUsed = rack.heightU > 0 ? Math.round((usedU / rack.heightU) * 100) : 0

  return {
    rack,
    devices,
    accessories,
    usedU,
    freeU,
    percentUsed,
    face,
  }
}

function colorForDevice(index: number): [number, number, number] {
  return DEVICE_COLORS[index % DEVICE_COLORS.length]
}

type ColumnLayout = {
  x: number
  w: number
  railW: number
  label: string
}

function layoutColumns(
  areaX: number,
  areaW: number,
  face: 'front' | 'rear' | 'both',
): ColumnLayout[] {
  const railW = 8
  if (face === 'both') {
    const gap = 4
    const half = (areaW - gap) / 2
    return [
      { x: areaX, w: half, railW, label: 'Frente' },
      { x: areaX + half + gap, w: half, railW, label: 'Dorso' },
    ]
  }
  return [
    {
      x: areaX,
      w: areaW,
      railW,
      label: face === 'rear' ? 'Dorso' : 'Frente',
    },
  ]
}

/**
 * Dibuja la elevación vectorial de un rack en el área dada.
 * Si mmPerU < 4.5, parte el rack en dos grupos de U lado a lado.
 */
function drawElevationGraphic(
  pdf: jsPDF,
  model: RackElevationModel,
  area: { x: number; y: number; w: number; h: number },
) {
  const heightU = Math.max(1, model.rack.heightU)
  const MIN_MM_PER_U = 4.5

  // ¿Cabe en una sola columna de U?
  let groups: Array<{ uHigh: number; uLow: number }> = [{ uHigh: heightU, uLow: 1 }]
  const mmPerUSingle = area.h / heightU
  if (mmPerUSingle < MIN_MM_PER_U && heightU > 20) {
    const mid = Math.ceil(heightU / 2)
    groups = [
      { uHigh: heightU, uLow: mid + 1 },
      { uHigh: mid, uLow: 1 },
    ]
  }

  const groupGap = groups.length > 1 ? 4 : 0
  const groupW = (area.w - groupGap * (groups.length - 1)) / groups.length

  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    const groupX = area.x + gi * (groupW + groupGap)
    const uCount = group.uHigh - group.uLow + 1
    const mmPerU = area.h / uCount
    const columns = layoutColumns(groupX, groupW, model.face)

    // Título de grupo si hay split
    if (groups.length > 1) {
      pdf.setFontSize(6)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(100, 116, 139)
      pdf.text(`U${group.uHigh}–U${group.uLow}`, groupX, area.y - 1.5)
    }

    for (const col of columns) {
      // Fondo del gabinete
      pdf.setFillColor(30, 41, 59)
      pdf.roundedRect(col.x, area.y, col.w, area.h, 1.5, 1.5, 'F')

      // Etiqueta de cara
      pdf.setFontSize(6)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(148, 163, 184)
      pdf.text(col.label, col.x + col.railW + 1, area.y + 3.5)

      // Riel con numeración U
      pdf.setFillColor(15, 23, 42)
      pdf.rect(col.x, area.y, col.railW, area.h, 'F')

      for (let u = group.uHigh; u >= group.uLow; u--) {
        const idx = group.uHigh - u
        const uy = area.y + idx * mmPerU
        pdf.setDrawColor(51, 65, 85)
        pdf.setLineWidth(0.15)
        pdf.line(col.x, uy, col.x + col.w, uy)

        if (u === group.uHigh || u === group.uLow || u % 5 === 0) {
          pdf.setFontSize(Math.min(5.5, Math.max(3.5, mmPerU * 0.7)))
          pdf.setFont('helvetica', 'normal')
          pdf.setTextColor(148, 163, 184)
          pdf.text(String(u), col.x + col.railW / 2, uy + mmPerU * 0.7, { align: 'center' })
        }
      }

      // Bandejas (accessories)
      const isRearCol = col.label === 'Dorso'
      for (const acc of model.accessories) {
        if (acc.unitStart < group.uLow || acc.unitStart > group.uHigh) continue
        const faces = acc.faces ?? ['front']
        if (model.face === 'both') {
          if (isRearCol && !faces.includes('rear')) continue
          if (!isRearCol && !faces.includes('front') && !faces.includes('rear')) continue
          // four_post aparece en ambas; front_only solo frente
          if (isRearCol && acc.mountType === 'front_only') continue
        }
        const topU = acc.unitStart + acc.heightU - 1
        const clippedHigh = Math.min(topU, group.uHigh)
        const clippedLow = Math.max(acc.unitStart, group.uLow)
        const yTop = area.y + (group.uHigh - clippedHigh) * mmPerU
        const h = (clippedHigh - clippedLow + 1) * mmPerU
        pdf.setFillColor(88, 28, 135)
        pdf.setDrawColor(167, 139, 250)
        pdf.setLineWidth(0.3)
        pdf.setLineDashPattern([1, 1], 0)
        pdf.rect(col.x + col.railW, yTop, col.w - col.railW, h, 'FD')
        pdf.setLineDashPattern([], 0)
        if (h >= 3.5) {
          pdf.setFontSize(5)
          pdf.setTextColor(221, 214, 254)
          pdf.text(`Bandeja: ${acc.name}`, col.x + col.railW + 1.5, yTop + Math.min(3.2, h - 0.5))
        }
      }

      // Equipos
      model.devices.forEach((dev, di) => {
        const showInCol =
          model.face !== 'both'
            ? true
            : dev.isFullDepth || (isRearCol ? dev.face === 'rear' : dev.face === 'front')
        if (!showInCol) return
        if (dev.unitEnd < group.uLow || dev.unitStart > group.uHigh) return

        const clippedHigh = Math.min(dev.unitEnd, group.uHigh)
        const clippedLow = Math.max(dev.unitStart, group.uLow)
        const yTop = area.y + (group.uHigh - clippedHigh) * mmPerU
        const h = (clippedHigh - clippedLow + 1) * mmPerU
        const color = colorForDevice(di)
        const contentX = col.x + col.railW + 0.6
        const contentW = col.w - col.railW - 1.2

        pdf.setFillColor(color[0], color[1], color[2])
        pdf.roundedRect(contentX, yTop + 0.3, contentW, h - 0.6, 0.8, 0.8, 'F')

        // Texto
        pdf.setTextColor(255, 255, 255)
        const fontSize = h >= 8 ? 7 : h >= 5 ? 5.5 : 4.5
        pdf.setFontSize(fontSize)
        pdf.setFont('helvetica', 'bold')
        const nameMaxW = contentW - 2
        const nameLines = pdf.splitTextToSize(dev.label, nameMaxW) as string[]
        let ty = yTop + Math.min(fontSize * 0.45 + 1.2, h * 0.45)
        pdf.text(nameLines[0] ?? dev.label, contentX + 1, ty)

        if (h >= 7) {
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(Math.max(4, fontSize - 1.5))
          const meta = [
            `U${dev.unitStart}–U${dev.unitEnd}`,
            [dev.manufacturer, dev.model].filter(Boolean).join(' ') || null,
            dev.ipAddress,
          ]
            .filter(Boolean)
            .join(' · ')
          ty += fontSize * 0.55 + 0.8
          if (ty < yTop + h - 1) {
            const metaLines = pdf.splitTextToSize(meta, nameMaxW) as string[]
            pdf.text(metaLines[0] ?? meta, contentX + 1, ty)
          }
        }

        // Badges
        const badges: string[] = []
        if (dev.isFullDepth) badges.push('Full')
        if (dev.onShelf) badges.push('Bandeja')
        if (badges.length && h >= 5) {
          pdf.setFontSize(4)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(255, 255, 255)
          pdf.setFillColor(15, 23, 42)
          let bx = contentX + contentW - 1
          for (const b of badges.reverse()) {
            const bw = pdf.getTextWidth(b) + 1.6
            bx -= bw + 0.6
            pdf.roundedRect(bx, yTop + 0.6, bw, 2.8, 0.5, 0.5, 'F')
            pdf.text(b, bx + 0.8, yTop + 2.5)
          }
        }
      })
    }
  }
}

const DEVICE_TABLE_COLUMNS: PdfTableColumn[] = [
  { header: 'U', proportion: 0.10 },
  { header: 'Equipo', proportion: 0.26 },
  { header: 'Hostname / IP', proportion: 0.22 },
  { header: 'Marca y modelo', proportion: 0.22 },
  { header: 'Cara', proportion: 0.10 },
  { header: 'Puertos', proportion: 0.10 },
]

function deviceTableCells(dev: RackElevationDevice): string[] {
  const faceLabel = dev.isFullDepth ? 'Ambas' : dev.face === 'rear' ? 'Dorso' : 'Frente'
  const hostIp = [dev.hostname, dev.ipAddress].filter(Boolean).join(' / ') || '—'
  const brand = [dev.manufacturer, dev.model].filter(Boolean).join(' ') || '—'
  return [
    `U${dev.unitStart}–U${dev.unitEnd}`,
    dev.label + (dev.onShelf ? ' (bandeja)' : ''),
    hostIp,
    brand,
    faceLabel,
    String(dev.portCount),
  ]
}

/**
 * Emite páginas de elevación + tabla de equipos por rack.
 * Devuelve la cantidad de páginas añadidas.
 */
export function appendRackElevationPages(
  pdf: jsPDF,
  opts: {
    models: RackElevationModel[]
    orientation: PrintOrientation
    projectName?: string
    authorName?: string
    dateStr: string
    title: string
    startingPageNumber: number
    totalPages: number
    branding?: PdfHeaderBranding
  },
): number {
  const {
    models,
    orientation,
    projectName,
    authorName,
    dateStr,
    title,
    startingPageNumber,
    totalPages,
    branding,
  } = opts

  let pagesAdded = 0
  const geom = getA4Geometry(orientation)

  for (const model of models) {
    // --- Página de elevación ---
    pdf.addPage('a4', orientation)
    pagesAdded++
    const pageNum = startingPageNumber + pagesAdded - 1
    const pw = geom.pageW
    const ph = geom.pageH

    const loc = [model.rack.siteName, model.rack.areaName, `${model.rack.heightU}U`]
      .filter(Boolean)
      .join(' · ')
    const occupancy = `${model.usedU}U usadas · ${model.freeU}U libres · ${model.percentUsed}%`
    const subtitle = [
      model.rack.code ? `${model.rack.name} (${model.rack.code})` : model.rack.name,
      loc,
      occupancy,
      `${model.devices.length} equipos`,
    ]
      .filter(Boolean)
      .join(' · ')

    drawHeader(pdf, pw, `Elevación de rack — ${title}`, projectName, subtitle, authorName, dateStr, branding)

    const elevArea = {
      x: geom.cover.x,
      y: geom.cover.y + 2,
      w: geom.cover.w,
      h: geom.cover.h - 4,
    }
    drawElevationGraphic(pdf, model, elevArea)
    drawFooter(pdf, pw, ph, pageNum, totalPages, dateStr, `Rack: ${model.rack.name}`)

    // --- Tabla de equipos (si hay) ---
    if (model.devices.length === 0) continue

    const tablePages = paginatePdfRows(
      pdf,
      pw,
      geom.table.y,
      geom.table.y + geom.table.h,
      DEVICE_TABLE_COLUMNS,
      model.devices,
      deviceTableCells,
    )

    for (let ti = 0; ti < tablePages.length; ti++) {
      pdf.addPage('a4', orientation)
      pagesAdded++
      const tPage = startingPageNumber + pagesAdded - 1
      const pageLabel =
        tablePages.length > 1
          ? `Equipos del rack ${model.rack.name} (${ti + 1}/${tablePages.length})`
          : `Equipos del rack ${model.rack.name}`

      drawHeader(
        pdf,
        pw,
        pageLabel,
        projectName,
        `${model.devices.length} equipos montados`,
        authorName,
        dateStr,
        branding,
      )

      const layout = getPdfTableLayout(pw, DEVICE_TABLE_COLUMNS)
      drawPdfTableHeader(pdf, geom.table.y, layout, DEVICE_TABLE_COLUMNS)
      drawPdfTableBody(
        pdf,
        geom.table.y,
        layout,
        tablePages[ti].map(deviceTableCells),
      )
      drawFooter(pdf, pw, ph, tPage, totalPages, dateStr, pageLabel)
    }
  }

  return pagesAdded
}

/**
 * Estima páginas de elevación + tabla por rack (sin dibujar).
 */
export function estimateRackElevationPages(
  pdf: jsPDF,
  models: RackElevationModel[],
  orientation: PrintOrientation,
): number {
  if (!models.length) return 0
  const geom = getA4Geometry(orientation)
  let total = 0
  for (const model of models) {
    total += 1 // elevación
    if (model.devices.length === 0) continue
    const pages = paginatePdfRows(
      pdf,
      geom.pageW,
      geom.table.y,
      geom.table.y + geom.table.h,
      DEVICE_TABLE_COLUMNS,
      model.devices,
      deviceTableCells,
    )
    total += pages.length
  }
  return total
}

/** Helper: ¿hay nodos fuera de rack en el alcance? */
export function hasUnrackedNodes(
  nodes: TopologyNode[],
  racks: TopologyRackSummary[],
): boolean {
  const accessoryIds = new Set(
    racks.flatMap((r) => (r.accessories ?? []).map((a) => a.id)),
  )
  const rackIds = new Set(racks.map((r) => r.id))
  return nodes.some((n) => {
    if (n.data.rackId && rackIds.has(n.data.rackId)) return false
    if (n.data.supportedByAccessoryId && accessoryIds.has(n.data.supportedByAccessoryId)) {
      return false
    }
    return true
  })
}
