import type { TopologyPortSummary } from '../types'

/** Ancho mínimo de la tarjeta del equipo (info del dispositivo). */
export const TOPOLOGY_NODE_MIN_WIDTH = 320

/** Alto fijo de la sección de información del dispositivo (sin panel de puertos). */
export const TOPOLOGY_HEADER_HEIGHT = 118
/** Cabecera más baja para patch panels (sin IP / VLANs). */
export const TOPOLOGY_HEADER_HEIGHT_PATCH = 92

export const PORT_CELL_WIDTH = 24
export const PORT_CELL_HEIGHT = 22

/** Celdas compactas (patch panels / switches con muchos puertos). */
export const COMPACT_PORT_CELL_WIDTH = 92
export const COMPACT_PORT_CELL_HEIGHT = 48

/** Hueco horizontal/vertical entre puertos (debe caber la etiqueta del enlace ≈ 100–110px). */
export const PORT_GAP = 48
export const PORT_PANEL_PADDING = 28
export const PORT_PANEL_HEADER_HEIGHT = 20
/** Etiquetas "1–12" / "13–24" entre filas. */
export const PORT_ROW_LABEL_HEIGHT = 18
/** Espacio bajo la última fila (salida visible de cables). */
export const PORT_DOT_OVERFLOW = 56

/** Columnas estándar en patch panel / switch 24 puertos. */
export const PATCH_PANEL_COLS = 12

/** Tipo de dispositivo del seeder para patch panels / cableado horizontal. */
export const STRUCTURED_CABLING_DEVICE_TYPE_NAME = 'Cableado Estructurado'

export function isStructuredCablingDeviceType(deviceType: string | null | undefined): boolean {
  const t = (deviceType ?? '').trim().toLowerCase()
  if (!t) return false
  return (
    t === STRUCTURED_CABLING_DEVICE_TYPE_NAME.toLowerCase() ||
    t.includes('patch') ||
    t.includes('cableado estructurado')
  )
}

export function portSourceHandleId(portId: string, side: 'top' | 'bottom' = 'bottom'): string {
  return `port-${portId}--out-${side}`
}

export function portTargetHandleId(portId: string, side: 'top' | 'bottom' = 'top'): string {
  return `port-${portId}--in-${side}`
}

export function parsePortIdFromHandle(handleId: string | null | undefined): string | null {
  if (!handleId) return null
  const match = /^port-(.+)--(?:out|in)-(?:top|bottom)$/.exec(handleId)
  return match?.[1] ?? null
}

/** Siempre muestra todos los puertos del equipo (conectados y libres). */
export function getDiagramDisplayPorts(ports: TopologyPortSummary[]): TopologyPortSummary[] {
  return sortTopologyPorts(ports)
}

/** Celdas amplias con nombre del puerto legible (campo `name` / `port`). */
export function isCompactPortPanel(_portCount: number, totalPortCount: number): boolean {
  return totalPortCount > 0
}

/**
 * Layout físico 1–12 / 13–24 solo en paneles grandes.
 * En equipos chicos (p. ej. puestos con puertos 13–16) se usa índice secuencial
 * para no empujar celdas y handles fuera del nodo.
 */
export function usesPhysicalPortLayout(layout: Pick<PortPanelLayout, 'cols' | 'totalPortCount'>): boolean {
  return layout.cols === PATCH_PANEL_COLS && layout.totalPortCount > 12
}

/** Fila/columna según número de puerto (físico) o índice en la lista ordenada. */
export function portGridSlot(
  portNumber: number,
  cols: number,
  sequentialIndex?: number,
  physical = false,
): { row: number; col: number } {
  const idx = physical
    ? Math.max(0, portNumber - 1)
    : Math.max(0, sequentialIndex ?? portNumber - 1)
  return { row: Math.floor(idx / cols), col: idx % cols }
}

export function computePortGrid(
  portCount: number,
  compact = false,
  totalPortCount = portCount,
): { cols: number; rows: number } {
  if (portCount <= 0) return { cols: 0, rows: 0 }

  if (totalPortCount > 12) {
    const slots = Math.max(totalPortCount, portCount)
    return { cols: PATCH_PANEL_COLS, rows: Math.ceil(slots / PATCH_PANEL_COLS) }
  }

  if (compact || !compact) {
    if (portCount <= 4) return { cols: portCount, rows: 1 }
    if (portCount <= 8) return { cols: 4, rows: Math.ceil(portCount / 4) }
  }
  if (portCount <= 24) return { cols: PATCH_PANEL_COLS, rows: Math.ceil(portCount / PATCH_PANEL_COLS) }
  return { cols: 24, rows: Math.ceil(portCount / 24) }
}

export type PortPanelLayout = {
  compact: boolean
  cols: number
  rows: number
  cellW: number
  cellH: number
  width: number
  height: number
  gridWidth: number
  gridHeight: number
  gridTop: number
  totalPortCount: number
  headerHeight: number
}

function cellMetrics(compact: boolean): { cellW: number; cellH: number } {
  return compact
    ? { cellW: COMPACT_PORT_CELL_WIDTH, cellH: COMPACT_PORT_CELL_HEIGHT }
    : { cellW: PORT_CELL_WIDTH, cellH: PORT_CELL_HEIGHT }
}

export function computePortPanelLayout(
  portCount: number,
  compact = false,
  totalPortCount = portCount,
  headerHeight = TOPOLOGY_HEADER_HEIGHT,
): PortPanelLayout {
  if (portCount <= 0) {
    return {
      compact,
      cols: 0,
      rows: 0,
      cellW: 0,
      cellH: 0,
      width: TOPOLOGY_NODE_MIN_WIDTH,
      height: headerHeight + 12,
      gridWidth: 0,
      gridHeight: 0,
      gridTop: headerHeight,
      totalPortCount,
      headerHeight,
    }
  }

  const { cols, rows } = computePortGrid(portCount, compact, totalPortCount)
  const { cellW, cellH } = cellMetrics(compact)
  const gridWidth = cols * cellW + (cols - 1) * PORT_GAP
  const gridHeight = rows * cellH + (rows - 1) * PORT_GAP

  const rowLabelsH = rows > 1 && cols === PATCH_PANEL_COLS ? PORT_ROW_LABEL_HEIGHT : 0
  const panelWidth = gridWidth + PORT_PANEL_PADDING * 2
  const panelHeight =
    PORT_PANEL_HEADER_HEIGHT +
    rowLabelsH +
    gridHeight +
    PORT_DOT_OVERFLOW +
    PORT_PANEL_PADDING * 2

  const gridTop =
    headerHeight +
    PORT_PANEL_PADDING +
    PORT_PANEL_HEADER_HEIGHT +
    rowLabelsH

  return {
    compact,
    cols,
    rows,
    cellW,
    cellH,
    width: Math.max(TOPOLOGY_NODE_MIN_WIDTH, panelWidth),
    height: headerHeight + panelHeight,
    gridWidth,
    gridHeight,
    gridTop,
    totalPortCount,
    headerHeight,
  }
}

export function computeNodeDimensions(
  portCount: number,
  compact = false,
  totalPortCount = portCount,
  headerHeight = TOPOLOGY_HEADER_HEIGHT,
): { width: number; height: number } {
  const layout = computePortPanelLayout(portCount, compact, totalPortCount, headerHeight)
  return { width: layout.width, height: layout.height }
}

function portGridMetrics(
  portNumber: number,
  layout: PortPanelLayout,
  nodeWidth: number,
  sequentialIndex?: number,
) {
  const physical = usesPhysicalPortLayout(layout)
  const { row, col } = portGridSlot(portNumber, layout.cols, sequentialIndex, physical)
  const gridStartX = (nodeWidth - layout.gridWidth) / 2
  const cellLeft = gridStartX + col * (layout.cellW + PORT_GAP)
  const cellTop = layout.gridTop + row * (layout.cellH + PORT_GAP)
  const centerX = cellLeft + layout.cellW / 2
  return { cellLeft, cellTop, centerX, cellH: layout.cellH, row, col }
}

/**
 * Handle de salida en el borde superior o inferior de la celda del puerto.
 * El cable nace en el puerto (no en el contorno del nodo).
 */
export function computePortSourceAnchor(
  portNumber: number,
  layout: PortPanelLayout,
  nodeWidth: number,
  _nodeHeight: number,
  sequentialIndex?: number,
  side: 'top' | 'bottom' = 'bottom',
): { x: number; y: number } {
  const { centerX, cellTop, cellH } = portGridMetrics(portNumber, layout, nodeWidth, sequentialIndex)
  return { x: centerX, y: side === 'top' ? cellTop : cellTop + cellH }
}

/**
 * Handle de entrada en el borde superior o inferior de la celda del puerto.
 */
export function computePortTargetAnchor(
  portNumber: number,
  layout: PortPanelLayout,
  nodeWidth: number,
  _nodeHeight: number,
  sequentialIndex?: number,
  side: 'top' | 'bottom' = 'top',
): { x: number; y: number } {
  const { centerX, cellTop, cellH } = portGridMetrics(portNumber, layout, nodeWidth, sequentialIndex)
  return { x: centerX, y: side === 'top' ? cellTop : cellTop + cellH }
}

/** Canal libre entre dos columnas de puertos. */
function laneGutter(layout: PortPanelLayout): number {
  return -(layout.cellW + PORT_GAP) / 2
}

/**
 * Vía de salida según el lado del nodo por el que sale el cable.
 * Evita que dos puertos de la misma columna compartan vertical.
 */
export function portSourceLaneOffsetX(
  portNumber: number,
  layout: PortPanelLayout,
  sequentialIndex?: number,
  side: 'top' | 'bottom' = 'bottom',
): number {
  if (layout.rows <= 1 || !usesPhysicalPortLayout(layout)) return 0
  const { row } = portGridSlot(portNumber, layout.cols, sequentialIndex, true)
  if (side === 'bottom') return row === 0 ? laneGutter(layout) : 0
  return row === layout.rows - 1 ? laneGutter(layout) : 0
}

/**
 * Vía de llegada según el lado por el que entra el cable.
 */
export function portTargetLaneOffsetX(
  portNumber: number,
  layout: PortPanelLayout,
  sequentialIndex?: number,
  side: 'top' | 'bottom' = 'top',
): number {
  if (layout.rows <= 1 || !usesPhysicalPortLayout(layout)) return 0
  const { row } = portGridSlot(portNumber, layout.cols, sequentialIndex, true)
  if (side === 'top') return row === layout.rows - 1 ? laneGutter(layout) : 0
  return row === 0 ? laneGutter(layout) : 0
}

export function sortTopologyPorts(ports: TopologyPortSummary[]): TopologyPortSummary[] {
  return [...ports].sort((a, b) => a.portNumber - b.portNumber || a.name.localeCompare(b.name))
}

export function indexOfPortInDisplay(portId: string, allPorts: TopologyPortSummary[]): number {
  const display = getDiagramDisplayPorts(allPorts)
  return display.findIndex((p) => p.id === portId)
}

export function portCellClasses(port: TopologyPortSummary): string {
  if (port.status === 'disabled') {
    return 'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500'
  }
  if (port.connected) {
    return port.status === 'up'
      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 ring-1 ring-emerald-500/50 dark:border-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-100'
      : 'border-amber-500 bg-amber-50 text-amber-900 ring-1 ring-amber-400/50 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-100'
  }
  return 'border-dashed border-gray-300 bg-gray-50/90 text-gray-400 dark:border-gray-600 dark:bg-gray-900/40 dark:text-gray-500'
}

/** Etiqueta corta para celdas densas; conserva el nombre del puerto (campo `port` / `name`). */
export function abbreviatePortName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 8) return trimmed
  return `${trimmed.slice(0, 7)}…`
}
