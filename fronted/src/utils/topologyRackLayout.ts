import type { RackFace, TopologyRackSummary } from '../types'

export const RACK_NODE_ID_PREFIX = 'rack:'

/** Vista del rack en el canvas (incluye "ambas caras"). */
export type RackViewFace = RackFace | 'both'

/** Píxeles por unidad de rack en el canvas. */
export const RACK_U_PX = 44
/** Cabecera del gabinete (nombre, sitio, toggle cara). */
export const RACK_HEADER_H = 52
/** Riel izquierdo con numeración U. */
export const RACK_RAIL_W = 28
/** Padding interno del área de equipos. */
export const RACK_INNER_PAD = 6
/** Ancho del área de equipos de una cara (sin riel). */
export const RACK_CONTENT_WIDTH = 380
/** Separación entre columnas frente/dorso en vista "ambas". */
export const RACK_COLUMN_GAP = 12
/** Separación horizontal entre racks en el layout automático. */
export const RACK_GRID_GAP_X = 72
/** Separación vertical entre filas de racks. */
export const RACK_GRID_GAP_Y = 64
/** Racks por fila en el layout automático. */
export const RACK_GRID_COLS = 3

export function rackFlowNodeId(rackId: string): string {
  return `${RACK_NODE_ID_PREFIX}${rackId}`
}

export function parseRackFlowNodeId(nodeId: string): string | null {
  if (!nodeId.startsWith(RACK_NODE_ID_PREFIX)) return null
  const id = nodeId.slice(RACK_NODE_ID_PREFIX.length)
  return id || null
}

export function isRackFlowNodeId(nodeId: string): boolean {
  return parseRackFlowNodeId(nodeId) != null
}

export function normalizeRackFace(face: string | null | undefined): RackFace {
  return face === 'rear' ? 'rear' : 'front'
}

export function normalizeRackViewFace(face: string | null | undefined): RackViewFace {
  if (face === 'both' || face === 'rear') return face
  return 'front'
}

/** Ancho del área de contenido según vista (1 o 2 columnas). */
export function rackContentWidth(view: RackViewFace = 'front'): number {
  if (view === 'both') {
    return RACK_CONTENT_WIDTH * 2 + RACK_COLUMN_GAP
  }
  return RACK_CONTENT_WIDTH
}

export function rackOuterSize(
  heightU: number,
  view: RackViewFace = 'front',
): { width: number; height: number } {
  const u = Math.max(1, Math.min(60, Math.round(heightU) || 42))
  return {
    width: RACK_RAIL_W + RACK_INNER_PAD * 2 + rackContentWidth(view),
    height: RACK_HEADER_H + RACK_INNER_PAD * 2 + u * RACK_U_PX,
  }
}

/**
 * Posición relativa del equipo dentro del rack.
 * Numeración alineada con inventario: U alta arriba, U1 abajo.
 * `column` 0 = frente, 1 = dorso (solo en vista "ambas").
 */
export function devicePositionInRack(
  rackUnitStart: number,
  rackUnits: number,
  rackHeightU: number,
  column: 0 | 1 = 0,
): { x: number; y: number; width: number; height: number } {
  const heightU = Math.max(1, rackHeightU)
  const units = Math.max(1, rackUnits)
  const start = Math.max(1, Math.min(rackUnitStart, heightU))
  const span = Math.min(units, heightU - start + 1)
  const topUnit = start + span - 1
  const yFromContentTop = (heightU - topUnit) * RACK_U_PX
  const x =
    RACK_RAIL_W +
    RACK_INNER_PAD +
    (column === 1 ? RACK_CONTENT_WIDTH + RACK_COLUMN_GAP : 0)
  return {
    x,
    y: RACK_HEADER_H + RACK_INNER_PAD + yFromContentTop,
    width: RACK_CONTENT_WIDTH,
    height: span * RACK_U_PX,
  }
}

/**
 * Posición de un equipo apoyado en bandeja (slots horizontales 0–2).
 * Crece hacia arriba desde la U base de la bandeja; no se recorta a la altura de la bandeja.
 * Visible en cara frontal; en vista rear solo si la bandeja es four_post (ocupación de riel).
 */
export function devicePositionOnShelf(params: {
  unitStart: number
  shelfHeightU: number
  rackHeightU: number
  slotStart: number
  widthSlots: number
  visualHeightU: number
  column?: 0 | 1
}): { x: number; y: number; width: number; height: number } {
  const column = params.column ?? 0
  const base = devicePositionInRack(
    params.unitStart,
    Math.max(1, params.shelfHeightU),
    params.rackHeightU,
    column
  )
  const widthSlots = Math.min(3, Math.max(1, params.widthSlots))
  const slotStart = Math.min(2, Math.max(0, params.slotStart))
  const slotW = RACK_CONTENT_WIDTH / 3
  const requestedU = Math.max(1, params.visualHeightU)
  // Cap only by rack ceiling so y stays within the rack content area
  const maxUFromBase = Math.max(1, params.rackHeightU - params.unitStart + 1)
  const visualU = Math.min(requestedU, maxUFromBase)
  const visualH = visualU * RACK_U_PX
  return {
    x: base.x + slotStart * slotW,
    y: base.y - (visualH - base.height),
    width: slotW * widthSlots,
    height: visualH,
  }
}

/** Posición de la bandeja (bloque de riel) en una columna. */
export function shelfPositionInRack(
  unitStart: number,
  heightU: number,
  rackHeightU: number,
  column: 0 | 1 = 0
): { x: number; y: number; width: number; height: number } {
  return devicePositionInRack(unitStart, heightU, rackHeightU, column)
}

/** Layout en grilla para racks sin posición guardada. */
export function layoutRacksGrid(
  racks: TopologyRackSummary[],
  existingPositions: Readonly<Record<string, { x: number; y: number }>> = {},
  rackViews: Readonly<Record<string, RackViewFace>> = {},
): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {}
  let col = 0
  let row = 0
  let rowMaxHeight = 0
  let cursorX = 0
  let cursorY = 0

  const sorted = [...racks].sort((a, b) => {
    const site = (a.siteName ?? '').localeCompare(b.siteName ?? '', 'es')
    if (site !== 0) return site
    const area = (a.areaName ?? '').localeCompare(b.areaName ?? '', 'es')
    if (area !== 0) return area
    return a.name.localeCompare(b.name, 'es')
  })

  for (const rack of sorted) {
    const id = rackFlowNodeId(rack.id)
    const saved = existingPositions[id]
    if (saved) {
      out[id] = { x: saved.x, y: saved.y }
      continue
    }

    const view = normalizeRackViewFace(rackViews[id] ?? rackViews[rack.id])
    const { width, height } = rackOuterSize(rack.heightU, view)
    if (col >= RACK_GRID_COLS) {
      cursorX = 0
      cursorY += rowMaxHeight + RACK_GRID_GAP_Y
      rowMaxHeight = 0
      col = 0
      row += 1
    }
    out[id] = { x: cursorX, y: cursorY }
    cursorX += width + RACK_GRID_GAP_X
    rowMaxHeight = Math.max(rowMaxHeight, height)
    col += 1
    void row
  }

  return out
}

/** Desplaza nodos sueltos a la derecha de todos los racks. */
export function freeDevicesOriginX(
  racks: TopologyRackSummary[],
  rackPositions: Readonly<Record<string, { x: number; y: number }>>,
  rackViews: Readonly<Record<string, RackViewFace>> = {},
): number {
  let maxRight = 0
  for (const rack of racks) {
    const id = rackFlowNodeId(rack.id)
    const pos = rackPositions[id] ?? { x: 0, y: 0 }
    const view = normalizeRackViewFace(rackViews[id] ?? rackViews[rack.id])
    const { width } = rackOuterSize(rack.heightU, view)
    maxRight = Math.max(maxRight, pos.x + width)
  }
  return racks.length ? maxRight + RACK_GRID_GAP_X : 0
}
