import type { RackFace, TopologyRackSummary } from '../types'

export const RACK_NODE_ID_PREFIX = 'rack:'

/** Píxeles por unidad de rack en el canvas. */
export const RACK_U_PX = 44
/** Cabecera del gabinete (nombre, sitio, toggle cara). */
export const RACK_HEADER_H = 52
/** Riel izquierdo con numeración U. */
export const RACK_RAIL_W = 28
/** Padding interno del área de equipos. */
export const RACK_INNER_PAD = 6
/** Ancho del área de equipos (sin riel). */
export const RACK_CONTENT_WIDTH = 380
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

export function rackOuterSize(heightU: number): { width: number; height: number } {
  const u = Math.max(1, Math.min(60, Math.round(heightU) || 42))
  return {
    width: RACK_RAIL_W + RACK_INNER_PAD * 2 + RACK_CONTENT_WIDTH,
    height: RACK_HEADER_H + RACK_INNER_PAD * 2 + u * RACK_U_PX,
  }
}

/**
 * Posición relativa del equipo dentro del rack.
 * Numeración alineada con inventario: U alta arriba, U1 abajo.
 */
export function devicePositionInRack(
  rackUnitStart: number,
  rackUnits: number,
  rackHeightU: number,
): { x: number; y: number; width: number; height: number } {
  const heightU = Math.max(1, rackHeightU)
  const units = Math.max(1, rackUnits)
  const start = Math.max(1, Math.min(rackUnitStart, heightU))
  const span = Math.min(units, heightU - start + 1)
  const topUnit = start + span - 1
  const yFromContentTop = (heightU - topUnit) * RACK_U_PX
  return {
    x: RACK_RAIL_W + RACK_INNER_PAD,
    y: RACK_HEADER_H + RACK_INNER_PAD + yFromContentTop,
    width: RACK_CONTENT_WIDTH,
    height: span * RACK_U_PX,
  }
}

/** Layout en grilla para racks sin posición guardada. */
export function layoutRacksGrid(
  racks: TopologyRackSummary[],
  existingPositions: Readonly<Record<string, { x: number; y: number }>> = {},
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

    const { width, height } = rackOuterSize(rack.heightU)
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
): number {
  let maxRight = 0
  for (const rack of racks) {
    const id = rackFlowNodeId(rack.id)
    const pos = rackPositions[id] ?? { x: 0, y: 0 }
    const { width } = rackOuterSize(rack.heightU)
    maxRight = Math.max(maxRight, pos.x + width)
  }
  return racks.length ? maxRight + RACK_GRID_GAP_X : 0
}

export function normalizeRackFace(face: string | null | undefined): RackFace {
  return face === 'rear' ? 'rear' : 'front'
}
