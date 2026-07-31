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
/** Etiquetas de fila superior/inferior en layout físico. */
export const PORT_ROW_LABEL_HEIGHT = 18
/** Espacio bajo la última fila (salida visible de cables). */
export const PORT_DOT_OVERFLOW = 56

/**
 * Columnas de referencia (patch panel / banco de 24).
 * En switches ≥18 puertos el layout físico usa `ceil(n/2)` columnas × 2 filas.
 */
export const PATCH_PANEL_COLS = 12

/** A partir de este conteo: numeración tipo switch (pares verticales). */
export const SWITCH_PHYSICAL_LAYOUT_MIN_PORTS = 18

/**
 * Patch panel Ethernet (faceplate): una fila lineal 1…N, bloques de 6.
 * Celdas compactas para caber 24 puertos en el ancho del rack / nodo.
 */
export const ETHERNET_FACEPLATE_BLOCK_SIZE = 6
export const ETHERNET_FACEPLATE_CELL_W = 22
export const ETHERNET_FACEPLATE_CELL_H = 28
export const ETHERNET_FACEPLATE_GAP = 3
export const ETHERNET_FACEPLATE_BLOCK_GAP = 12

/** Modo de disposición de puertos físicos. */
export type PortPanelLayoutMode = 'default' | 'switchPairs' | 'ethernetFaceplate'

export type PortPanelLayoutHints = {
  deviceType?: string | null
  ports?: Array<Pick<TopologyPortSummary, 'portType' | 'isPassthrough'>>
  /** Fuerza faceplate Ethernet (tests / override). */
  ethernetFaceplate?: boolean
}

/** Chips SSID (sección WiFi, no se ven como puertos RJ45). */
export const WIFI_CHIP_WIDTH = 108
export const WIFI_CHIP_HEIGHT = 40
export const WIFI_GAP = 14
export const WIFI_PANEL_HEADER_HEIGHT = 20
/** Separación entre la grilla de puertos físicos y la sección WiFi. */
export const WIFI_SECTION_GAP = 14

/** Tipo de dispositivo del seeder para patch panels / cableado horizontal. */
export const STRUCTURED_CABLING_DEVICE_TYPE_NAME = 'Cableado Estructurado'

/** Nube de Internet / ISP: se dibuja como nube con puerto general invisible. */
export const INTERNET_CLOUD_DEVICE_TYPE_NAME = 'Internet'

/** Tamaño fijo del nodo nube en el diagrama. */
export const CLOUD_NODE_WIDTH = 200
export const CLOUD_NODE_HEIGHT = 120

export type PortPanelSection = 'physical' | 'wireless'

export function isWirelessPort(port: Pick<TopologyPortSummary, 'portType'>): boolean {
  return port.portType === 'wireless'
}

export function partitionDiagramPorts(ports: TopologyPortSummary[]): {
  physical: TopologyPortSummary[]
  wireless: TopologyPortSummary[]
} {
  const sorted = sortTopologyPorts(ports)
  const physical: TopologyPortSummary[] = []
  const wireless: TopologyPortSummary[] = []
  for (const port of sorted) {
    if (isWirelessPort(port)) wireless.push(port)
    else physical.push(port)
  }
  return { physical, wireless }
}

export function isStructuredCablingDeviceType(deviceType: string | null | undefined): boolean {
  const t = (deviceType ?? '').trim().toLowerCase()
  if (!t) return false
  return (
    t === STRUCTURED_CABLING_DEVICE_TYPE_NAME.toLowerCase() ||
    t.includes('patch') ||
    t.includes('cableado estructurado')
  )
}

function isEthernetPortType(portType: string | null | undefined): boolean {
  const t = (portType ?? '').trim().toLowerCase()
  if (!t) return false
  return t === 'ethernet' || t === 'rj45' || t.includes('ethernet')
}

function isNonEthernetPanelPortType(portType: string | null | undefined): boolean {
  const t = (portType ?? '').trim().toLowerCase()
  if (!t) return false
  return (
    t === 'coaxial' ||
    t === 'coax' ||
    t.includes('coax') ||
    t === 'fiber' ||
    t.includes('fiber') ||
    t === 'sfp' ||
    t.includes('sfp')
  )
}

/**
 * Patch panel RJ45: numeración lineal 1…N en una fila, bloques de 6.
 * Aplica a cableado estructurado / patch (salvo mayoría coax/fibra) y a
 * paneles passthrough con mayoría de puertos ethernet.
 */
export function shouldUseEthernetFaceplateLayout(
  deviceType: string | null | undefined,
  ports: Array<Pick<TopologyPortSummary, 'portType' | 'isPassthrough'>> = [],
): boolean {
  const physical = ports.filter((p) => !isWirelessPort(p))
  const ethCount = physical.filter((p) => isEthernetPortType(p.portType)).length
  const otherPanelCount = physical.filter((p) => isNonEthernetPanelPortType(p.portType)).length

  if (isStructuredCablingDeviceType(deviceType)) {
    if (physical.length === 0) return true
    if (otherPanelCount > ethCount && otherPanelCount > physical.length / 2) return false
    return true
  }

  const typeName = (deviceType ?? '').trim().toLowerCase()
  if (typeName.includes('ethernet') && physical.length >= 12) {
    const passthrough = physical.filter((p) => p.isPassthrough).length
    if (passthrough >= physical.length * 0.5) return true
  }

  if (physical.length < 12) return false
  const ethPass = physical.filter((p) => p.isPassthrough && isEthernetPortType(p.portType)).length
  return ethPass >= physical.length * 0.5
}

export function resolvePortPanelLayoutMode(
  totalPhysicalPortCount: number,
  hints?: PortPanelLayoutHints,
): PortPanelLayoutMode {
  if (
    hints?.ethernetFaceplate === true ||
    (hints &&
      shouldUseEthernetFaceplateLayout(hints.deviceType, hints.ports ?? []))
  ) {
    return 'ethernetFaceplate'
  }
  if (totalPhysicalPortCount >= SWITCH_PHYSICAL_LAYOUT_MIN_PORTS) return 'switchPairs'
  return 'default'
}

/** Presupuesto de gaps horizontales (intra-bloque + entre bloques). */
export function faceplateHorizontalGaps(
  cols: number,
  gap: number,
  blockGap: number,
  blockSize = ETHERNET_FACEPLATE_BLOCK_SIZE,
): number {
  if (cols <= 1) return 0
  const blocks = Math.ceil(cols / blockSize)
  const inBlockGaps = cols - blocks
  const betweenBlocks = Math.max(0, blocks - 1)
  return inBlockGaps * gap + betweenBlocks * blockGap
}

/** Offset X de la columna `col` (0-based) en layout faceplate con bloques. */
export function faceplateColumnOffsetX(
  col: number,
  cellW: number,
  gap: number,
  blockGap: number,
  blockSize = ETHERNET_FACEPLATE_BLOCK_SIZE,
): number {
  if (col <= 0) return 0
  const blocksBefore = Math.floor(col / blockSize)
  return col * (cellW + gap) + blocksBefore * (blockGap - gap)
}

/** ISP / Internet / nube: forma de nube y puerto general oculto en el canvas. */
export function isInternetCloudDeviceType(deviceType: string | null | undefined): boolean {
  const t = (deviceType ?? '').trim().toLowerCase()
  if (!t) return false
  return (
    t === INTERNET_CLOUD_DEVICE_TYPE_NAME.toLowerCase() ||
    t === 'internet service provider' ||
    t === 'isp' ||
    t === 'nube' ||
    t === 'cloud' ||
    t.includes('internet')
  )
}

export function portSourceHandleId(
  portId: string,
  side: 'top' | 'bottom' = 'bottom',
  face: 'front' | 'rear' = 'front',
): string {
  return `port-${portId}--${face}--out-${side}`
}

export function portTargetHandleId(
  portId: string,
  side: 'top' | 'bottom' = 'top',
  face: 'front' | 'rear' = 'front',
): string {
  return `port-${portId}--${face}--in-${side}`
}

/** Handle interactivo centrado en la celda (drag-to-connect). */
export function portConnectSourceHandleId(portId: string, face: 'front' | 'rear' = 'front'): string {
  return `port-${portId}--${face}--out-connect`
}

export function portConnectTargetHandleId(portId: string, face: 'front' | 'rear' = 'front'): string {
  return `port-${portId}--${face}--in-connect`
}

const PORT_HANDLE_RE =
  /^port-(.+)--(?:(front|rear)--)(?:out|in)-(?:top|bottom|connect)$/
/** Legacy handles without face (pre-passthrough). */
const PORT_HANDLE_LEGACY_RE = /^port-(.+)--(?:out|in)-(?:top|bottom|connect)$/

export function parsePortIdFromHandle(handleId: string | null | undefined): string | null {
  if (!handleId) return null
  const withFace = PORT_HANDLE_RE.exec(handleId)
  if (withFace) return withFace[1]
  const legacy = PORT_HANDLE_LEGACY_RE.exec(handleId)
  return legacy?.[1] ?? null
}

export function parsePortFaceFromHandle(
  handleId: string | null | undefined,
): 'front' | 'rear' {
  if (!handleId) return 'front'
  const withFace = PORT_HANDLE_RE.exec(handleId)
  if (withFace?.[2] === 'rear' || withFace?.[2] === 'front') return withFace[2]
  return 'front'
}

export function portFaceConnected(
  port: Pick<TopologyPortSummary, 'connected' | 'connectedFront' | 'connectedRear' | 'isPassthrough'>,
  face: 'front' | 'rear',
): boolean {
  if (face === 'rear') return !!port.connectedRear
  if (port.connectedFront != null) return !!port.connectedFront
  return !!port.connected
}

export function portFaceConnectable(
  port: TopologyPortSummary,
  face: 'front' | 'rear',
  readOnly: boolean,
): boolean {
  if (readOnly || port.status !== 'up') return false
  if (face === 'rear' && !port.isPassthrough) return false
  return !portFaceConnected(port, face)
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
 * Layout físico tipo switch (pares verticales) en paneles ≥18 puertos.
 * En equipos chicos se usa índice secuencial fila a fila.
 * Patch panels Ethernet usan faceplate lineal (no pares verticales).
 */
export function usesPhysicalPortLayout(
  layout: Pick<PortPanelLayout, 'totalPortCount' | 'layoutMode'>,
): boolean {
  if (layout.layoutMode === 'ethernetFaceplate') return false
  if (layout.layoutMode === 'switchPairs') return true
  return layout.totalPortCount >= SWITCH_PHYSICAL_LAYOUT_MIN_PORTS
}

export function usesEthernetFaceplateLayout(
  layout: Pick<PortPanelLayout, 'layoutMode'>,
): boolean {
  return layout.layoutMode === 'ethernetFaceplate'
}

/**
 * Fila/columna según número de puerto (físico) o índice en la lista ordenada.
 * Físico: columnas de a pares — 1 arriba, 2 abajo, 3 a la derecha de 1, etc.
 */
export function portGridSlot(
  portNumber: number,
  cols: number,
  sequentialIndex?: number,
  physical = false,
): { row: number; col: number } {
  const idx = physical
    ? Math.max(0, portNumber - 1)
    : Math.max(0, sequentialIndex ?? portNumber - 1)
  if (physical) {
    return { row: idx % 2, col: Math.floor(idx / 2) }
  }
  const safeCols = Math.max(1, cols)
  return { row: Math.floor(idx / safeCols), col: idx % safeCols }
}

/** Grilla 2 filas × N columnas para switches con numeración en pares verticales. */
export function computeSwitchPhysicalGrid(portCount: number): { cols: number; rows: number } {
  if (portCount <= 0) return { cols: 0, rows: 0 }
  if (portCount === 1) return { cols: 1, rows: 1 }
  return { cols: Math.ceil(portCount / 2), rows: 2 }
}

export function computePortGrid(
  portCount: number,
  compact = false,
  totalPortCount = portCount,
  layoutMode: PortPanelLayoutMode = 'default',
): { cols: number; rows: number } {
  if (portCount <= 0) return { cols: 0, rows: 0 }

  if (layoutMode === 'ethernetFaceplate') {
    return { cols: portCount, rows: 1 }
  }

  if (layoutMode === 'switchPairs' || totalPortCount >= SWITCH_PHYSICAL_LAYOUT_MIN_PORTS) {
    const slots = Math.max(totalPortCount, portCount)
    return computeSwitchPhysicalGrid(slots)
  }

  if (compact || !compact) {
    if (portCount <= 4) return { cols: portCount, rows: 1 }
    if (portCount <= 8) return { cols: 4, rows: Math.ceil(portCount / 4) }
  }
  if (portCount <= 24) return { cols: PATCH_PANEL_COLS, rows: Math.ceil(portCount / PATCH_PANEL_COLS) }
  return { cols: 24, rows: Math.ceil(portCount / 24) }
}

export function computeWifiGrid(wirelessCount: number): { cols: number; rows: number } {
  if (wirelessCount <= 0) return { cols: 0, rows: 0 }
  if (wirelessCount <= 3) return { cols: wirelessCount, rows: 1 }
  if (wirelessCount <= 6) return { cols: 3, rows: Math.ceil(wirelessCount / 3) }
  return { cols: 4, rows: Math.ceil(wirelessCount / 4) }
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
  /** Conteo de puertos físicos (excluye wireless). */
  totalPortCount: number
  headerHeight: number
  physicalCount: number
  wirelessCount: number
  wifiCols: number
  wifiRows: number
  wifiCellW: number
  wifiCellH: number
  wifiGridWidth: number
  wifiGridHeight: number
  wifiGridTop: number
  hasPhysical: boolean
  hasWireless: boolean
  /** Gap horizontal/vertical entre celdas físicas (default PORT_GAP). */
  portGap?: number
  /** Gap entre chips WiFi (default WIFI_GAP). */
  wifiGap?: number
  /** Alto de la subcabecera «Puertos» (0 = oculta; típico en rack 1U). */
  panelHeaderH?: number
  /** Padding del panel de puertos (rack montado). */
  portPanelPad?: number
  /** Alto de la subcabecera WiFi en rack (0 = oculta). */
  wifiPanelHeaderH?: number
  /** Disposición: switch pares / faceplate Ethernet / secuencial. */
  layoutMode?: PortPanelLayoutMode
  /** Tamaño de bloque en faceplate (default 6). */
  blockSize?: number
  /** Gap extra entre bloques faceplate. */
  blockGap?: number
}

function cellMetrics(compact: boolean, cols = PATCH_PANEL_COLS): { cellW: number; cellH: number } {
  if (!compact) return { cellW: PORT_CELL_WIDTH, cellH: PORT_CELL_HEIGHT }
  // Switches anchos (p. ej. 48 → 24 cols): achicar celdas para no inflar el nodo.
  if (cols > PATCH_PANEL_COLS) {
    const scale = PATCH_PANEL_COLS / cols
    return {
      cellW: Math.max(40, Math.round(COMPACT_PORT_CELL_WIDTH * scale)),
      cellH: Math.max(30, Math.round(COMPACT_PORT_CELL_HEIGHT * Math.min(1, 0.7 + scale * 0.3))),
    }
  }
  return { cellW: COMPACT_PORT_CELL_WIDTH, cellH: COMPACT_PORT_CELL_HEIGHT }
}

function emptyWifiMetrics(): Pick<
  PortPanelLayout,
  | 'wifiCols'
  | 'wifiRows'
  | 'wifiCellW'
  | 'wifiCellH'
  | 'wifiGridWidth'
  | 'wifiGridHeight'
  | 'wifiGridTop'
  | 'physicalCount'
  | 'wirelessCount'
  | 'hasPhysical'
  | 'hasWireless'
> {
  return {
    wifiCols: 0,
    wifiRows: 0,
    wifiCellW: WIFI_CHIP_WIDTH,
    wifiCellH: WIFI_CHIP_HEIGHT,
    wifiGridWidth: 0,
    wifiGridHeight: 0,
    wifiGridTop: 0,
    physicalCount: 0,
    wirelessCount: 0,
    hasPhysical: false,
    hasWireless: false,
  }
}

/**
 * @param physicalCount Puertos no-wireless visibles en la grilla
 * @param totalPhysicalPortCount Total físico del equipo (para layout switch pares verticales)
 * @param wirelessCount Interfaces `portType: wireless` (SSID)
 * @param hints deviceType / ports para elegir faceplate Ethernet vs switch
 */
export function computePortPanelLayout(
  physicalCount: number,
  compact = false,
  totalPhysicalPortCount = physicalCount,
  headerHeight = TOPOLOGY_HEADER_HEIGHT,
  wirelessCount = 0,
  hints?: PortPanelLayoutHints,
): PortPanelLayout {
  const hasPhysical = physicalCount > 0
  const hasWireless = wirelessCount > 0
  const layoutMode = resolvePortPanelLayoutMode(totalPhysicalPortCount, hints)
  const faceplate = layoutMode === 'ethernetFaceplate'

  if (!hasPhysical && !hasWireless) {
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
      totalPortCount: totalPhysicalPortCount,
      headerHeight,
      layoutMode,
      ...emptyWifiMetrics(),
    }
  }

  const { cols, rows } = hasPhysical
    ? computePortGrid(physicalCount, compact, totalPhysicalPortCount, layoutMode)
    : { cols: 0, rows: 0 }

  const portGap = faceplate ? ETHERNET_FACEPLATE_GAP : PORT_GAP
  const blockSize = faceplate ? ETHERNET_FACEPLATE_BLOCK_SIZE : undefined
  const blockGap = faceplate ? ETHERNET_FACEPLATE_BLOCK_GAP : undefined

  let cellW = 0
  let cellH = 0
  if (hasPhysical) {
    if (faceplate) {
      cellW = ETHERNET_FACEPLATE_CELL_W
      cellH = ETHERNET_FACEPLATE_CELL_H
    } else {
      const m = cellMetrics(compact, cols)
      cellW = m.cellW
      cellH = m.cellH
    }
  }

  const gridWidth = hasPhysical
    ? faceplate
      ? cols * cellW + faceplateHorizontalGaps(cols, portGap, blockGap!, blockSize!)
      : cols * cellW + (cols - 1) * portGap
    : 0
  const gridHeight = hasPhysical ? rows * cellH + (rows - 1) * portGap : 0
  const rowLabelsH =
    hasPhysical && rows > 1 && layoutMode === 'switchPairs' ? PORT_ROW_LABEL_HEIGHT : 0

  const { cols: wifiCols, rows: wifiRows } = computeWifiGrid(wirelessCount)
  const wifiCellW = WIFI_CHIP_WIDTH
  const wifiCellH = WIFI_CHIP_HEIGHT
  const wifiGridWidth =
    hasWireless ? wifiCols * wifiCellW + (wifiCols - 1) * WIFI_GAP : 0
  const wifiGridHeight =
    hasWireless ? wifiRows * wifiCellH + (wifiRows - 1) * WIFI_GAP : 0

  const physicalBlockH = hasPhysical
    ? PORT_PANEL_HEADER_HEIGHT + rowLabelsH + gridHeight
    : 0
  const wirelessBlockH = hasWireless
    ? WIFI_PANEL_HEADER_HEIGHT + wifiGridHeight
    : 0
  const betweenSections = hasPhysical && hasWireless ? WIFI_SECTION_GAP : 0

  const contentWidth = Math.max(gridWidth, wifiGridWidth)
  const panelWidth = contentWidth + PORT_PANEL_PADDING * 2
  const panelHeight =
    PORT_PANEL_PADDING +
    physicalBlockH +
    betweenSections +
    wirelessBlockH +
    PORT_DOT_OVERFLOW +
    PORT_PANEL_PADDING

  const gridTop = hasPhysical
    ? headerHeight + PORT_PANEL_PADDING + PORT_PANEL_HEADER_HEIGHT + rowLabelsH
    : headerHeight

  const wifiGridTop = hasWireless
    ? hasPhysical
      ? gridTop + gridHeight + WIFI_SECTION_GAP + WIFI_PANEL_HEADER_HEIGHT
      : headerHeight + PORT_PANEL_PADDING + WIFI_PANEL_HEADER_HEIGHT
    : 0

  return {
    compact: faceplate ? true : compact,
    cols,
    rows,
    cellW,
    cellH,
    width: Math.max(TOPOLOGY_NODE_MIN_WIDTH, panelWidth),
    height: headerHeight + panelHeight,
    gridWidth,
    gridHeight,
    gridTop,
    totalPortCount: totalPhysicalPortCount,
    headerHeight,
    physicalCount,
    wirelessCount,
    wifiCols,
    wifiRows,
    wifiCellW,
    wifiCellH,
    wifiGridWidth,
    wifiGridHeight,
    wifiGridTop,
    hasPhysical,
    hasWireless,
    ...(faceplate
      ? { portGap, blockSize, blockGap, layoutMode }
      : { layoutMode }),
  }
}

/** Cabecera compacta de equipo montado en rack (≥2U). */
export const RACK_MOUNTED_HEADER_HEIGHT = 20
/** Cabecera ultra-densa (~1U): nombre + contador en una sola franja. */
export const RACK_MOUNTED_HEADER_HEIGHT_DENSE = 16
const RACK_PORT_GAP = 2
const RACK_PORT_GAP_ROOMY = 3
const RACK_PORT_PAD = 2
const RACK_PORT_PAD_ROOMY = 4
/** Mínimos de referencia; el layout puede bajar de estos para encajar. */
const RACK_PORT_CELL_W_MIN = 10
const RACK_PORT_CELL_H_MIN = 8
const RACK_PORT_CELL_H_MAX = 22
const RACK_PORT_CELL_W_MAX = 28
const RACK_PORT_HEADER_H = 12
const RACK_WIFI_CELL_H_MIN = 14
const RACK_WIFI_CELL_H_MAX = 22
const RACK_SECTION_GAP = 2
const RACK_PANEL_HEADER_MARGIN = 2
/** ~1U: priorizar que la grilla quepa dentro del rectángulo. */
const RACK_DENSE_HEIGHT_PX = 48

/**
 * Layout denso para equipos dentro de un rack: chrome mínimo en 1U y
 * celdas que crecen para llenar el cuerpo en multi-U (sin desbordar el slot).
 */
export function computeRackMountedPortPanelLayout(
  physicalCount: number,
  totalPhysicalPortCount = physicalCount,
  wirelessCount = 0,
  targetWidth: number,
  targetHeight: number,
  hints?: PortPanelLayoutHints,
): PortPanelLayout {
  const width = Math.max(80, targetWidth)
  const height = Math.max(RACK_MOUNTED_HEADER_HEIGHT_DENSE, targetHeight)
  const dense = height <= RACK_DENSE_HEIGHT_PX
  const headerHeight = dense ? RACK_MOUNTED_HEADER_HEIGHT_DENSE : RACK_MOUNTED_HEADER_HEIGHT
  const portPad = dense ? RACK_PORT_PAD : RACK_PORT_PAD_ROOMY
  const portGapBase = dense ? RACK_PORT_GAP : RACK_PORT_GAP_ROOMY
  const hasPhysical = physicalCount > 0
  const hasWireless = wirelessCount > 0
  const layoutMode = resolvePortPanelLayoutMode(totalPhysicalPortCount, hints)
  const faceplate = layoutMode === 'ethernetFaceplate'
  const portGap = faceplate ? Math.min(portGapBase, 2) : portGapBase
  const blockSize = faceplate ? ETHERNET_FACEPLATE_BLOCK_SIZE : undefined
  const blockGap = faceplate ? Math.max(portGap + 3, dense ? 5 : 7) : undefined

  if (!hasPhysical && !hasWireless) {
    return {
      compact: true,
      cols: 0,
      rows: 0,
      cellW: 0,
      cellH: 0,
      width,
      height,
      gridWidth: 0,
      gridHeight: 0,
      gridTop: headerHeight,
      totalPortCount: totalPhysicalPortCount,
      headerHeight,
      panelHeaderH: 0,
      portPanelPad: portPad,
      wifiPanelHeaderH: 0,
      layoutMode,
      ...emptyWifiMetrics(),
    }
  }

  const bodyH = Math.max(0, height - headerHeight)
  const innerH = Math.max(0, bodyH - portPad * 2)
  const availableW = Math.max(40, width - portPad * 2)

  // Subcabeceras solo si hay aire vertical (en 1U el contador va en la cabecera principal).
  const wantPanelHeader = hasPhysical && !dense && innerH >= 40
  const panelHeaderH = wantPanelHeader ? RACK_PORT_HEADER_H : 0
  const panelHeaderMargin = panelHeaderH > 0 ? RACK_PANEL_HEADER_MARGIN : 0
  const wantWifiHeader = hasWireless && !dense && innerH >= 40
  const wifiPanelHeaderH = wantWifiHeader ? RACK_PORT_HEADER_H : 0
  const wifiHeaderMargin = wifiPanelHeaderH > 0 ? RACK_PANEL_HEADER_MARGIN : 0
  const betweenSections = hasPhysical && hasWireless ? RACK_SECTION_GAP : 0

  const chromeH =
    panelHeaderH +
    panelHeaderMargin +
    wifiPanelHeaderH +
    wifiHeaderMargin +
    betweenSections
  const gridsBudget = Math.max(hasPhysical || hasWireless ? RACK_PORT_CELL_H_MIN : 0, innerH - chromeH)

  let cols = 0
  let rows = 0
  if (hasPhysical) {
    if (faceplate) {
      cols = Math.max(1, physicalCount)
      rows = 1
    } else if (layoutMode === 'switchPairs') {
      const slots = Math.max(totalPhysicalPortCount, physicalCount)
      const grid = computeSwitchPhysicalGrid(slots)
      cols = grid.cols
      rows = grid.rows
    } else {
      cols = Math.max(
        1,
        Math.min(
          24,
          Math.min(physicalCount, Math.floor((availableW + portGap) / (RACK_PORT_CELL_W_MIN + portGap))),
        ),
      )
      rows = Math.max(1, Math.ceil(physicalCount / cols))
    }
  }

  const { cols: wifiCols, rows: wifiRows } = computeWifiGrid(wirelessCount)

  // Reparte alto entre grillas física y WiFi (prioridad a física).
  let physBudget = 0
  let wifiBudget = 0
  if (hasPhysical && hasWireless) {
    const physWeight = rows
    const wifiWeight = Math.max(1, wifiRows)
    const totalWeight = physWeight + wifiWeight
    physBudget = Math.floor((gridsBudget * physWeight) / totalWeight)
    wifiBudget = gridsBudget - physBudget
  } else if (hasPhysical) {
    physBudget = gridsBudget
  } else {
    wifiBudget = gridsBudget
  }

  // Encajar en el ancho disponible (priorizar no desbordar sobre el mínimo estético).
  const gapBudget = faceplate
    ? faceplateHorizontalGaps(cols, portGap, blockGap!, blockSize!)
    : (cols - 1) * portGap
  const cellW = hasPhysical
    ? Math.min(
        faceplate ? 16 : RACK_PORT_CELL_W_MAX,
        Math.max(1, Math.floor((availableW - gapBudget) / Math.max(1, cols))),
      )
    : 0
  let cellH = 0
  if (hasPhysical && rows > 0) {
    const raw = Math.floor((physBudget - (rows - 1) * portGap) / rows)
    // Faceplate 1U: celdas bajas y anchas-relativas; cap más bajo para parecer jacks.
    const maxH = faceplate ? Math.min(RACK_PORT_CELL_H_MAX, dense ? 14 : 18) : RACK_PORT_CELL_H_MAX
    cellH = Math.max(1, Math.min(maxH, raw))
  }
  const gridWidth = hasPhysical
    ? faceplate
      ? cols * cellW + faceplateHorizontalGaps(cols, portGap, blockGap!, blockSize!)
      : cols * cellW + (cols - 1) * portGap
    : 0
  const gridHeight = hasPhysical ? rows * cellH + (rows - 1) * portGap : 0

  const wifiCellW = hasWireless
    ? Math.min(
        WIFI_CHIP_WIDTH,
        Math.max(48, Math.floor((availableW - (wifiCols - 1) * portGap) / Math.max(1, wifiCols))),
      )
    : WIFI_CHIP_WIDTH
  let wifiCellH = WIFI_CHIP_HEIGHT
  if (hasWireless && wifiRows > 0) {
    const raw = Math.floor((wifiBudget - (wifiRows - 1) * portGap) / wifiRows)
    wifiCellH = Math.max(RACK_WIFI_CELL_H_MIN, Math.min(RACK_WIFI_CELL_H_MAX, raw))
  }
  const wifiGridWidth = hasWireless ? wifiCols * wifiCellW + (wifiCols - 1) * portGap : 0
  const wifiGridHeight = hasWireless ? wifiRows * wifiCellH + (wifiRows - 1) * portGap : 0

  const contentH =
    (hasPhysical ? panelHeaderH + panelHeaderMargin + gridHeight : 0) +
    betweenSections +
    (hasWireless ? wifiPanelHeaderH + wifiHeaderMargin + wifiGridHeight : 0)
  const contentOffsetY = Math.max(0, Math.floor((innerH - contentH) / 2))

  const gridTop = hasPhysical
    ? headerHeight + portPad + contentOffsetY + panelHeaderH + panelHeaderMargin
    : headerHeight
  const wifiGridTop = hasWireless
    ? hasPhysical
      ? gridTop + gridHeight + betweenSections + wifiPanelHeaderH + wifiHeaderMargin
      : headerHeight + portPad + contentOffsetY + wifiPanelHeaderH + wifiHeaderMargin
    : 0

  return {
    compact: true,
    cols,
    rows,
    cellW,
    cellH,
    width,
    height,
    gridWidth,
    gridHeight,
    gridTop,
    totalPortCount: totalPhysicalPortCount,
    headerHeight,
    physicalCount,
    wirelessCount,
    wifiCols,
    wifiRows,
    wifiCellW,
    wifiCellH,
    wifiGridWidth,
    wifiGridHeight,
    wifiGridTop,
    hasPhysical,
    hasWireless,
    portGap,
    wifiGap: portGap,
    panelHeaderH,
    portPanelPad: portPad,
    wifiPanelHeaderH,
    layoutMode,
    ...(faceplate ? { blockSize, blockGap } : {}),
  }
}

export function computeNodeDimensions(
  physicalCount: number,
  compact = false,
  totalPhysicalPortCount = physicalCount,
  headerHeight = TOPOLOGY_HEADER_HEIGHT,
  wirelessCount = 0,
  hints?: PortPanelLayoutHints,
): { width: number; height: number } {
  const layout = computePortPanelLayout(
    physicalCount,
    compact,
    totalPhysicalPortCount,
    headerHeight,
    wirelessCount,
    hints,
  )
  return { width: layout.width, height: layout.height }
}

function portGridMetrics(
  portNumber: number,
  layout: PortPanelLayout,
  nodeWidth: number,
  sequentialIndex?: number,
  section: PortPanelSection = 'physical',
) {
  if (section === 'wireless') {
    const cols = Math.max(1, layout.wifiCols)
    const gap = layout.wifiGap ?? WIFI_GAP
    const { row, col } = portGridSlot(portNumber, cols, sequentialIndex, false)
    const gridStartX = (nodeWidth - layout.wifiGridWidth) / 2
    const cellLeft = gridStartX + col * (layout.wifiCellW + gap)
    const cellTop = layout.wifiGridTop + row * (layout.wifiCellH + gap)
    const centerX = cellLeft + layout.wifiCellW / 2
    return { cellLeft, cellTop, centerX, cellH: layout.wifiCellH, row, col }
  }

  const physical = usesPhysicalPortLayout(layout)
  const gap = layout.portGap ?? PORT_GAP
  const { row, col } = portGridSlot(portNumber, layout.cols, sequentialIndex, physical)
  const gridStartX = (nodeWidth - layout.gridWidth) / 2
  const cellLeft =
    usesEthernetFaceplateLayout(layout) && layout.blockGap != null && layout.blockSize != null
      ? gridStartX +
        faceplateColumnOffsetX(col, layout.cellW, gap, layout.blockGap, layout.blockSize)
      : gridStartX + col * (layout.cellW + gap)
  const cellTop = layout.gridTop + row * (layout.cellH + gap)
  const centerX = cellLeft + layout.cellW / 2
  return { cellLeft, cellTop, centerX, cellH: layout.cellH, row, col }
}

/**
 * Centro de la celda del puerto (hit-area para drag-to-connect).
 * En passthrough, `face` desplaza el ancla a izquierda (rear) o derecha (front).
 */
export function computePortConnectAnchor(
  portNumber: number,
  layout: PortPanelLayout,
  nodeWidth: number,
  _nodeHeight: number,
  sequentialIndex?: number,
  section: PortPanelSection = 'physical',
  face: 'front' | 'rear' = 'front',
  passthrough = false,
): { x: number; y: number; cellW: number; cellH: number } {
  const m = portGridMetrics(portNumber, layout, nodeWidth, sequentialIndex, section)
  const cellW = section === 'wireless' ? layout.wifiCellW : layout.cellW
  let x = m.centerX
  if (passthrough && section === 'physical') {
    const offset = cellW * 0.22
    x = face === 'rear' ? m.centerX - offset : m.centerX + offset
  }
  const hitW = passthrough && section === 'physical' ? Math.max(10, cellW * 0.42) : cellW
  return {
    x,
    y: m.cellTop + m.cellH / 2,
    cellW: hitW,
    cellH: m.cellH,
  }
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
  section: PortPanelSection = 'physical',
  face: 'front' | 'rear' = 'front',
  passthrough = false,
): { x: number; y: number } {
  const { centerX, cellTop, cellH } = portGridMetrics(
    portNumber,
    layout,
    nodeWidth,
    sequentialIndex,
    section,
  )
  const cellW = section === 'wireless' ? layout.wifiCellW : layout.cellW
  let x = centerX
  if (passthrough && section === 'physical') {
    const offset = cellW * 0.22
    x = face === 'rear' ? centerX - offset : centerX + offset
  }
  return { x, y: side === 'top' ? cellTop : cellTop + cellH }
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
  section: PortPanelSection = 'physical',
  face: 'front' | 'rear' = 'front',
  passthrough = false,
): { x: number; y: number } {
  const { centerX, cellTop, cellH } = portGridMetrics(
    portNumber,
    layout,
    nodeWidth,
    sequentialIndex,
    section,
  )
  const cellW = section === 'wireless' ? layout.wifiCellW : layout.cellW
  let x = centerX
  if (passthrough && section === 'physical') {
    const offset = cellW * 0.22
    x = face === 'rear' ? centerX - offset : centerX + offset
  }
  return { x, y: side === 'top' ? cellTop : cellTop + cellH }
}

/** Canal libre entre dos columnas de puertos. */
function laneGutter(layout: PortPanelLayout): number {
  return -(layout.cellW + (layout.portGap ?? PORT_GAP)) / 2
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
  section: PortPanelSection = 'physical',
): number {
  if (section === 'wireless') return 0
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
  section: PortPanelSection = 'physical',
): number {
  if (section === 'wireless') return 0
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

/** Índice dentro de su sección (física o WiFi) para anclar handles. */
export function indexOfPortInSection(
  portId: string,
  ports: TopologyPortSummary[],
): { index: number; section: PortPanelSection } {
  const { physical, wireless } = partitionDiagramPorts(ports)
  const wifiIdx = wireless.findIndex((p) => p.id === portId)
  if (wifiIdx >= 0) return { index: wifiIdx, section: 'wireless' }
  const physIdx = physical.findIndex((p) => p.id === portId)
  return { index: physIdx, section: 'physical' }
}

export type PortCellDensity = 'default' | 'rack'

export function portCellClasses(port: TopologyPortSummary, density: PortCellDensity = 'default'): string {
  const rack = density === 'rack'
  if (port.status === 'disabled') {
    return rack
      ? 'border-slate-700/80 bg-slate-900/60 text-slate-600'
      : 'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500'
  }
  const front = portFaceConnected(port, 'front')
  const rear = port.isPassthrough ? portFaceConnected(port, 'rear') : false
  const both = front && rear
  const any = front || rear || port.connected
  if (both) {
    if (rack) {
      return port.status === 'up'
        ? 'border-emerald-500/80 bg-emerald-900/55 text-emerald-100'
        : 'border-amber-500/70 bg-amber-900/45 text-amber-100'
    }
    return port.status === 'up'
      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500/80 dark:bg-emerald-950/55 dark:text-emerald-100'
      : 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600/80 dark:bg-amber-950/45 dark:text-amber-100'
  }
  if (any && port.isPassthrough) {
    return rack
      ? 'border-sky-500/70 bg-sky-950/50 text-sky-100'
      : 'border-sky-500 bg-sky-50/90 text-sky-900 dark:border-sky-500/80 dark:bg-sky-950/40 dark:text-sky-100'
  }
  if (any) {
    if (rack) {
      return port.status === 'up'
        ? 'border-emerald-500/80 bg-emerald-900/55 text-emerald-100'
        : 'border-amber-500/70 bg-amber-900/45 text-amber-100'
    }
    return port.status === 'up'
      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-500/80 dark:bg-emerald-950/55 dark:text-emerald-100'
      : 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600/80 dark:bg-amber-950/45 dark:text-amber-100'
  }
  // Libre: borde sólido sutil (sin dashed) — menos ruido en grillas densas.
  return rack
    ? 'border-slate-600/70 bg-slate-800/70 text-slate-400'
    : 'border-gray-300/90 bg-gray-50/90 text-gray-400 dark:border-gray-600/80 dark:bg-gray-800/50 dark:text-gray-500'
}

export function wifiChipClasses(port: TopologyPortSummary): string {
  if (port.status === 'disabled') {
    return 'border-gray-300 bg-gray-100 text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-500'
  }
  if (port.connected) {
    return port.status === 'up'
      ? 'border-sky-500 bg-sky-50 text-sky-900 dark:border-sky-400/80 dark:bg-sky-950/50 dark:text-sky-100'
      : 'border-amber-500 bg-amber-50 text-amber-900 dark:border-amber-600/80 dark:bg-amber-950/45 dark:text-amber-100'
  }
  return 'border-sky-300/70 bg-sky-50/50 text-sky-600/80 dark:border-sky-700/70 dark:bg-sky-950/25 dark:text-sky-400'
}

/** Etiqueta corta para celdas densas; conserva el nombre del puerto (campo `port` / `name`). */
export function abbreviatePortName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 8) return trimmed
  return `${trimmed.slice(0, 7)}…`
}

/**
 * Etiqueta para celdas de rack: solo el número (estilo faceplate).
 * El nombre completo queda en el `title` / tooltip.
 */
export function rackPortLabel(port: Pick<TopologyPortSummary, 'portNumber'>): string {
  return String(port.portNumber)
}
