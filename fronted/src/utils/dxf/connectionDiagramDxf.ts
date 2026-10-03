import {
  Colors,
  DxfWriter,
  LWPolylineFlags,
  TextHorizontalAlignment,
  TextVerticalAlignment,
  Units,
  point2d,
  point3d,
} from '@tarikjabiri/dxf'
import type { DiagramHandleSide, MediumType } from '../../types'
import {
  SIMPLE_DEVICE_META_H,
  SIMPLE_DEVICE_NAME_LINE_H,
} from '../../components/diagram/SimpleDeviceNode'
import {
  DIAGRAM_CONTAINER_TITLE_PX,
  DIAGRAM_DEVICE_META_PX,
  DIAGRAM_DEVICE_NAME_PX,
  DIAGRAM_LINK_REF_PX,
  DIAGRAM_PORT_LABEL_PX,
} from '../diagram/diagramTypography'
import { TARGET_MM_PER_FLOW_PX } from '../pdf/diagramScale'
import type {
  DiagramExportScene,
  ExportBounds,
  ExportContainer,
  ExportDevice,
  ExportLink,
  ExportRect,
} from '../diagram/exportScene'

export type ConnectionDiagramDxfMeta = {
  title: string
  projectName?: string
  clientName?: string
  date?: string
}

const LAYER = {
  areas: 'AREAS',
  racks: 'RACKS',
  boards: 'TABLEROS',
  devices: 'EQUIPOS',
  ports: 'PUERTOS',
  utp: 'ENLACES_UTP',
  fiber: 'ENLACES_FIBRA',
  wifi: 'ENLACES_WIFI',
  internet: 'ENLACES_INTERNET',
  labels: 'ETIQUETAS',
  title: 'ROTULO',
} as const

const LTYPE = {
  wifi: 'WIFI',
  internet: 'INTERNET',
} as const

const MARGIN_MM = 12
const TITLE_LINE_MM = 4.2
/** Tailwind `px-2` / `py-1` del encabezado del equipo. */
const DEVICE_PAD_X_PX = 8
const DEVICE_PAD_Y_PX = 4
/** Barra de acento del nodo. Más ancha que el borde de 4 px para que se lea en CAD. */
const DEVICE_ACCENT_MM = 1.2
/**
 * Pluma al imprimir. El trazo del canvas (2 px) a la escala de impresión
 * queda por debajo de 0,3 mm y casi no se ve en papel.
 */
const LINK_STROKE_MM = 0.5
const OUTLINE_STROKE_MM = 0.35
const PORT_MARK_MM = 0.8
/** slate-900, el mismo tono que el nombre en el canvas claro. ACI 7 se pierde en fondo blanco. */
const DEVICE_INK = '#0f172a'

function hexToTrueColor(hex: string): string {
  const raw = hex.trim().replace('#', '')
  const n = Number.parseInt(raw, 16)
  if (!Number.isFinite(n) || raw.length < 6) return '10066329'
  return String(n)
}

function plainText(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

function pxToMm(px: number): number {
  return px * TARGET_MM_PER_FLOW_PX
}

function linkLayer(medium: MediumType): string {
  switch (medium) {
    case 'fiber':
      return LAYER.fiber
    case 'wifi':
      return LAYER.wifi
    case 'internet':
      return LAYER.internet
    default:
      return LAYER.utp
  }
}

function linkLineType(link: ExportLink): string | undefined {
  if (link.medium === 'wifi') return LTYPE.wifi
  if (link.medium === 'internet') return LTYPE.internet
  return undefined
}

type CadPoint = { x: number; y: number }

function makeCad(bounds: ExportBounds) {
  const scale = TARGET_MM_PER_FLOW_PX
  return (x: number, y: number): CadPoint => ({
    x: MARGIN_MM + (x - bounds.minX) * scale,
    y: MARGIN_MM + (bounds.maxY - y) * scale,
  })
}

function rectCorners(rect: ExportRect, cad: (x: number, y: number) => CadPoint) {
  const topLeft = cad(rect.x, rect.y)
  const bottomRight = cad(rect.x + rect.width, rect.y + rect.height)
  return { topLeft, bottomRight }
}

function addClosedRect(
  dxf: DxfWriter,
  topLeft: CadPoint,
  bottomRight: CadPoint,
  layerName: string,
  trueColor?: string,
  strokeMm = OUTLINE_STROKE_MM,
) {
  dxf.addLWPolyline(
    [
      { point: point2d(topLeft.x, topLeft.y) },
      { point: point2d(bottomRight.x, topLeft.y) },
      { point: point2d(bottomRight.x, bottomRight.y) },
      { point: point2d(topLeft.x, bottomRight.y) },
    ],
    {
      flags: LWPolylineFlags.Closed,
      layerName,
      constantWidth: strokeMm,
      ...(trueColor ? { trueColor } : {}),
    },
  )
}

function containerLayer(kind: ExportContainer['kind']): string {
  if (kind === 'rack') return LAYER.racks
  if (kind === 'board') return LAYER.boards
  return LAYER.areas
}

function containerCaption(container: ExportContainer): string {
  return container.code ? `${container.name} (${container.code})` : container.name
}

function addLabel(
  dxf: DxfWriter,
  at: CadPoint,
  heightMm: number,
  value: string,
  options: {
    layerName: string
    horizontal?: TextHorizontalAlignment
    vertical?: TextVerticalAlignment
    trueColor?: string
  },
) {
  const text = plainText(value)
  if (!text || !(heightMm > 0)) return
  const point = point3d(at.x, at.y, 0)
  dxf.addText(point, heightMm, text, {
    layerName: options.layerName,
    horizontalAlignment: options.horizontal ?? TextHorizontalAlignment.Left,
    verticalAlignment: options.vertical ?? TextVerticalAlignment.BaseLine,
    secondAlignmentPoint: point,
    ...(options.trueColor ? { trueColor: options.trueColor } : {}),
  })
}

function addContainer(dxf: DxfWriter, container: ExportContainer, cad: (x: number, y: number) => CadPoint) {
  const { topLeft, bottomRight } = rectCorners(container.rect, cad)
  const layerName = containerLayer(container.kind)
  addClosedRect(dxf, topLeft, bottomRight, layerName)
  addLabel(
    dxf,
    { x: topLeft.x + pxToMm(DEVICE_PAD_X_PX), y: topLeft.y - pxToMm(DEVICE_PAD_Y_PX) },
    pxToMm(DIAGRAM_CONTAINER_TITLE_PX),
    containerCaption(container),
    { layerName, vertical: TextVerticalAlignment.Top },
  )
}

function addDevice(dxf: DxfWriter, device: ExportDevice, cad: (x: number, y: number) => CadPoint) {
  const { topLeft, bottomRight } = rectCorners(device.rect, cad)
  addClosedRect(dxf, topLeft, bottomRight, LAYER.devices)
  addClosedRect(
    dxf,
    topLeft,
    { x: topLeft.x + DEVICE_ACCENT_MM, y: bottomRight.y },
    LAYER.devices,
    hexToTrueColor(device.accentColor),
  )

  const padX = pxToMm(DEVICE_PAD_X_PX)
  const padY = pxToMm(DEVICE_PAD_Y_PX)
  const boxH = topLeft.y - bottomRight.y
  const usable = boxH - padY * 2
  if (!(usable > 0)) return

  const ink = hexToTrueColor(DEVICE_INK)
  const nameCap = Math.min(pxToMm(DIAGRAM_DEVICE_NAME_PX), pxToMm(SIMPLE_DEVICE_NAME_LINE_H), usable)
  const x = topLeft.x + DEVICE_ACCENT_MM + padX
  let cursor = topLeft.y - padY
  const floor = bottomRight.y + padY

  addLabel(dxf, { x, y: cursor }, nameCap, device.name, {
    layerName: LAYER.devices,
    vertical: TextVerticalAlignment.Top,
    trueColor: ink,
  })
  cursor -= Math.min(pxToMm(SIMPLE_DEVICE_NAME_LINE_H), cursor - floor)

  const metaH = pxToMm(DIAGRAM_DEVICE_META_PX)
  const metaStep = pxToMm(SIMPLE_DEVICE_META_H)
  for (const line of [device.deviceType, device.ipAddress]) {
    if (!line?.trim() || cursor - metaH < floor) break
    addLabel(dxf, { x, y: cursor }, metaH, line, {
      layerName: LAYER.devices,
      vertical: TextVerticalAlignment.Top,
      trueColor: ink,
    })
    cursor -= metaStep
  }
}

function portLabelPlacement(side: DiagramHandleSide, at: CadPoint): {
  point: CadPoint
  horizontal: TextHorizontalAlignment
  vertical: TextVerticalAlignment
} {
  const gap = PORT_MARK_MM + pxToMm(DIAGRAM_PORT_LABEL_PX) * 1.75
  switch (side) {
    case 'left':
      return {
        point: { x: at.x - gap, y: at.y },
        horizontal: TextHorizontalAlignment.Right,
        vertical: TextVerticalAlignment.Middle,
      }
    case 'top':
      return {
        point: { x: at.x, y: at.y + gap },
        horizontal: TextHorizontalAlignment.Center,
        vertical: TextVerticalAlignment.Bottom,
      }
    case 'bottom':
      return {
        point: { x: at.x, y: at.y - gap },
        horizontal: TextHorizontalAlignment.Center,
        vertical: TextVerticalAlignment.Top,
      }
    default:
      return {
        point: { x: at.x + gap, y: at.y },
        horizontal: TextHorizontalAlignment.Left,
        vertical: TextVerticalAlignment.Middle,
      }
  }
}

function addPorts(dxf: DxfWriter, device: ExportDevice, cad: (x: number, y: number) => CadPoint) {
  for (const port of device.ports) {
    const at = cad(port.x, port.y)
    dxf.addCircle(point3d(at.x, at.y, 0), PORT_MARK_MM, { layerName: LAYER.ports })
    if (!port.label.trim()) continue
    const place = portLabelPlacement(port.side, at)
    addLabel(dxf, place.point, pxToMm(DIAGRAM_PORT_LABEL_PX), port.label, {
      layerName: LAYER.ports,
      horizontal: place.horizontal,
      vertical: place.vertical,
    })
  }
}

function addLink(dxf: DxfWriter, link: ExportLink, cad: (x: number, y: number) => CadPoint) {
  const layerName = linkLayer(link.medium)
  dxf.addLWPolyline(
    link.points.map((p) => {
      const at = cad(p.x, p.y)
      return { point: point2d(at.x, at.y) }
    }),
    {
      layerName,
      trueColor: hexToTrueColor(link.color),
      lineType: linkLineType(link),
      constantWidth: LINK_STROKE_MM,
    },
  )
  addLabel(dxf, cad(link.label.x, link.label.y), pxToMm(DIAGRAM_LINK_REF_PX), link.code, {
    layerName: LAYER.labels,
    horizontal: TextHorizontalAlignment.Center,
    vertical: TextVerticalAlignment.Middle,
  })
}

function addTitleBlock(
  dxf: DxfWriter,
  meta: ConnectionDiagramDxfMeta,
  scene: DiagramExportScene,
  contentTop: number,
) {
  const view = scene.layoutMode === 'tree' ? 'Árbol' : 'Libre'
  const date =
    meta.date ??
    new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
  const lines = [
    plainText(meta.title) || 'Diagrama de conexión',
    meta.projectName?.trim() ? `Proyecto: ${plainText(meta.projectName)}` : '',
    meta.clientName?.trim() ? `Cliente: ${plainText(meta.clientName)}` : '',
    `Vista: ${view}`,
    `Fecha: ${date}`,
  ].filter(Boolean)

  lines.forEach((line, index) => {
    const y = contentTop + 6 + (lines.length - 1 - index) * TITLE_LINE_MM
    addLabel(dxf, { x: MARGIN_MM, y }, index === 0 ? 3.4 : 2.6, line, {
      layerName: LAYER.title,
    })
  })

  return contentTop + 6 + lines.length * TITLE_LINE_MM
}

/**
 * DXF R2007 (UTF-8), unidades en milímetros, eje Y de CAD hacia arriba.
 * Escala fija de impresión al 100% (`TARGET_MM_PER_FLOW_PX`).
 */
export function buildConnectionDiagramDxf(
  scene: DiagramExportScene,
  meta: ConnectionDiagramDxfMeta,
): string {
  const dxf = new DxfWriter()
  dxf.setUnits(Units.Millimeters)
  dxf.addLType(LTYPE.wifi, 'WiFi __ __ __', [4, -2])
  dxf.addLType(LTYPE.internet, 'Internet ____ . ____ .', [8, -2, 1.2, -2])

  dxf.addLayer(LAYER.areas, 8, 'Continuous')
  dxf.addLayer(LAYER.racks, Colors.Cyan, 'Continuous')
  dxf.addLayer(LAYER.boards, Colors.Green, 'Continuous')
  dxf.addLayer(LAYER.devices, Colors.White, 'Continuous')
  dxf.addLayer(LAYER.ports, Colors.Yellow, 'Continuous')
  dxf.addLayer(LAYER.utp, Colors.Blue, 'Continuous')
  dxf.addLayer(LAYER.fiber, 30, 'Continuous')
  dxf.addLayer(LAYER.wifi, Colors.Green, LTYPE.wifi)
  dxf.addLayer(LAYER.internet, Colors.Cyan, LTYPE.internet)
  dxf.addLayer(LAYER.labels, Colors.Magenta, 'Continuous')
  dxf.addLayer(LAYER.title, Colors.White, 'Continuous')

  const cad = makeCad(scene.bounds)
  const contentH = Math.max(0, scene.bounds.maxY - scene.bounds.minY) * TARGET_MM_PER_FLOW_PX
  const contentW = Math.max(0, scene.bounds.maxX - scene.bounds.minX) * TARGET_MM_PER_FLOW_PX
  const contentTop = MARGIN_MM + contentH

  const kindOrder: Record<ExportContainer['kind'], number> = { area: 0, rack: 1, board: 2 }
  const containers = [...scene.containers].sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind])
  for (const container of containers) addContainer(dxf, container, cad)
  for (const link of scene.links) addLink(dxf, link, cad)
  for (const device of scene.devices) addDevice(dxf, device, cad)
  for (const device of scene.devices) addPorts(dxf, device, cad)

  const titleTop = addTitleBlock(dxf, meta, scene, contentTop)
  dxf.setVariable('$EXTMIN', { 10: 0, 20: 0, 30: 0 })
  dxf.setVariable('$EXTMAX', {
    10: MARGIN_MM + contentW + MARGIN_MM,
    20: titleTop + MARGIN_MM,
    30: 0,
  })

  return dxf.stringify()
}
