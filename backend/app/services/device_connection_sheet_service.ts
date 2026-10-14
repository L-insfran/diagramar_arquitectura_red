import { DateTime } from 'luxon'
import ExcelJS from 'exceljs'
import DeviceRepository from '#repositories/device_repository'
import DiagramLinkRepository from '#repositories/diagram_link_repository'
import PortType from '#models/port_type'
import type Device from '#models/device'
import type DiagramLink from '#models/diagram_link'
import type Port from '#models/port'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
const COL_COUNT = 10
const ORIGIN_FILL = 'FF1F4E79'
const MEDIUM_FILL = 'FF9A5B13'
const DEST_FILL = 'FF1E6B45'
const ORIGIN_HEADER = 'FFD6E3F0'
const MEDIUM_HEADER = 'FFF4E4D4'
const DEST_HEADER = 'FFD9EDE3'
const FREE_ROW = 'FFF3F4F6'
const UNASSIGNED_ROW = 'FFFFF7ED'
const TITLE_FILL = 'FF0F172A'
const NOTE =
  'Cada fila es un puerto de este equipo. El destino es el otro extremo del enlace documentado. Para ver el tramo siguiente, descargá la planilla de ese equipo.'

const HEADERS = [
  'Equipo',
  'Puerto',
  'Tipo de puerto',
  'Código',
  'Cable',
  'Función',
  'Etiqueta',
  'Equipo',
  'Puerto',
  'Dónde está',
] as const

const WIDTHS = [28, 16, 18, 12, 18, 16, 24, 28, 16, 36]

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD0D5DD' } },
  left: { style: 'thin', color: { argb: 'FFD0D5DD' } },
  bottom: { style: 'thin', color: { argb: 'FFD0D5DD' } },
  right: { style: 'thin', color: { argb: 'FFD0D5DD' } },
}

type SheetEstado = 'Conectado' | 'Libre' | 'Sin puerto'

type SheetRow = {
  equipo: string
  puerto: string
  tipoPuerto: string
  estado: SheetEstado
  codigo: string
  cable: string
  funcion: string
  etiqueta: string
  destinoEquipo: string
  destinoPuerto: string
  dondeEsta: string
}

type OrientedLink = {
  link: DiagramLink
  thisPortId: string | null
  thisLabel: string
  otherDevice: Device | null
  otherPort: Port | null
  otherLabel: string
}

export type DeviceConnectionSheetFile = {
  buffer: Buffer
  filename: string
  mimeType: string
}

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeLabel(value: string | null | undefined): string {
  const trimmed = clean(value).replace(/^-+/, '').trim()
  if (!trimmed || trimmed === '?') return ''
  return trimmed.toLocaleLowerCase('es')
}

function formatPlace(device: Device | null | undefined): string {
  if (!device) return ''
  const parts = [device.site?.name, device.area?.name, device.container?.name]
    .map((part) => clean(part))
    .filter(Boolean)
  if (device.container?.kind === 'rack' && device.rackUnitStart != null) {
    parts.push(`U ${device.rackUnitStart}`)
  }
  return parts.join(' / ')
}

function formatCode(code: number | null | undefined): string {
  if (code == null) return ''
  return `E${code}`
}

function destinationPortLabel(port: Port | null, label: string): string {
  const fromPort = clean(port?.name)
  if (fromPort) return fromPort
  return clean(label).replace(/^-+/, '').trim()
}

function sheetFilename(deviceName: string): string {
  const slug = deviceName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `conexiones-${slug || 'equipo'}.xlsx`
}

function orient(link: DiagramLink, deviceId: string): OrientedLink {
  const fromSource = link.sourceDeviceId === deviceId
  return {
    link,
    thisPortId: fromSource ? link.sourcePortId : link.targetPortId,
    thisLabel: fromSource ? link.sourcePortLabel : link.targetPortLabel,
    otherDevice: fromSource ? (link.targetDevice ?? null) : (link.sourceDevice ?? null),
    otherPort: fromSource ? (link.targetPort ?? null) : (link.sourcePort ?? null),
    otherLabel: fromSource ? link.targetPortLabel : link.sourcePortLabel,
  }
}

function matchPortByLabel(label: string, ports: Port[]): Port | null {
  const key = normalizeLabel(label)
  if (!key) return null
  const byName = ports.filter((port) => normalizeLabel(port.name) === key)
  if (byName.length === 1) return byName[0]
  if (byName.length > 1) return null
  const byNumber = ports.filter((port) => String(port.portNumber) === key)
  return byNumber.length === 1 ? byNumber[0] : null
}

function connectedRow(
  device: Device,
  port: Port | null,
  portLabel: string,
  oriented: OrientedLink,
  portTypeNames: Map<string, string>,
  estado: SheetEstado,
): SheetRow {
  const link = oriented.link
  return {
    equipo: device.name,
    puerto: port ? clean(port.name) || String(port.portNumber) : portLabel || '(sin puerto)',
    tipoPuerto: port ? (portTypeNames.get(port.portType) ?? port.portType) : '',
    estado,
    codigo: formatCode(link.code),
    cable: clean(link.cableType?.name),
    funcion: clean(link.linkType?.name),
    etiqueta: clean(link.description),
    destinoEquipo: clean(oriented.otherDevice?.name),
    destinoPuerto: destinationPortLabel(oriented.otherPort, oriented.otherLabel),
    dondeEsta: formatPlace(oriented.otherDevice),
  }
}

function freeRow(device: Device, port: Port, portTypeNames: Map<string, string>): SheetRow {
  return {
    equipo: device.name,
    puerto: clean(port.name) || String(port.portNumber),
    tipoPuerto: portTypeNames.get(port.portType) ?? port.portType,
    estado: 'Libre',
    codigo: '',
    cable: '',
    funcion: '',
    etiqueta: '',
    destinoEquipo: '',
    destinoPuerto: '',
    dondeEsta: '',
  }
}

function buildRows(
  device: Device,
  links: DiagramLink[],
  portTypeNames: Map<string, string>,
): { rows: SheetRow[]; unassigned: SheetRow[]; connectedPorts: number } {
  const ports = [...(device.ports ?? [])].sort((a, b) => a.portNumber - b.portNumber)
  const byPort = new Map<string, OrientedLink[]>()
  const unmatched: OrientedLink[] = []

  for (const link of links) {
    const oriented = orient(link, device.id)
    const byId = oriented.thisPortId
      ? ports.find((port) => port.id === oriented.thisPortId)
      : undefined
    const port = byId ?? matchPortByLabel(oriented.thisLabel, ports)
    if (!port) {
      unmatched.push(oriented)
      continue
    }
    const bucket = byPort.get(port.id) ?? []
    bucket.push(oriented)
    byPort.set(port.id, bucket)
  }

  const rows: SheetRow[] = []
  let connectedPorts = 0
  for (const port of ports) {
    const attached = byPort.get(port.id) ?? []
    if (attached.length === 0) {
      rows.push(freeRow(device, port, portTypeNames))
      continue
    }
    connectedPorts += 1
    for (const oriented of attached) {
      rows.push(connectedRow(device, port, '', oriented, portTypeNames, 'Conectado'))
    }
  }

  const unassigned = unmatched.map((oriented) => {
    const label = clean(oriented.thisLabel).replace(/^-+/, '').trim()
    return connectedRow(device, null, label, oriented, portTypeNames, 'Sin puerto')
  })

  return { rows, unassigned, connectedPorts }
}

function solidFill(argb: string): ExcelJS.Fill {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

function applyRangeFill(
  sheet: ExcelJS.Worksheet,
  row: number,
  start: number,
  end: number,
  argb: string,
) {
  for (let col = start; col <= end; col += 1) {
    const cell = sheet.getCell(row, col)
    cell.fill = solidFill(argb)
    cell.border = thinBorder
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  }
}

function writeGroupHeaders(sheet: ExcelJS.Worksheet, row: number) {
  const groups: Array<[number, number, string, string]> = [
    [1, 3, 'Origen', ORIGIN_FILL],
    [4, 7, 'Medio', MEDIUM_FILL],
    [8, 10, 'Destino', DEST_FILL],
  ]
  for (const [start, end, title, fill] of groups) {
    sheet.mergeCells(row, start, row, end)
    applyRangeFill(sheet, row, start, end, fill)
    const cell = sheet.getCell(row, start)
    cell.value = title
    cell.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FFFFFFFF' } }
  }
  sheet.getRow(row).height = 22
}

function headerFillForColumn(col: number): string {
  if (col <= 3) return ORIGIN_HEADER
  if (col <= 7) return MEDIUM_HEADER
  return DEST_HEADER
}

function writeColumnHeaders(sheet: ExcelJS.Worksheet, row: number) {
  HEADERS.forEach((header, index) => {
    const cell = sheet.getCell(row, index + 1)
    cell.value = header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } }
    cell.fill = solidFill(headerFillForColumn(index + 1))
    cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true }
    cell.border = thinBorder
  })
  sheet.getRow(row).height = 20
}

function rowValues(row: SheetRow): string[] {
  return [
    row.equipo,
    row.puerto,
    row.tipoPuerto,
    row.codigo,
    row.cable,
    row.funcion,
    row.etiqueta,
    row.destinoEquipo,
    row.destinoPuerto,
    row.dondeEsta,
  ]
}

function writeDataRow(sheet: ExcelJS.Worksheet, rowNumber: number, data: SheetRow) {
  const values = rowValues(data)
  const fill =
    data.estado === 'Libre' ? FREE_ROW : data.estado === 'Sin puerto' ? UNASSIGNED_ROW : null
  values.forEach((value, index) => {
    const cell = sheet.getCell(rowNumber, index + 1)
    cell.value = value
    cell.font = {
      name: 'Calibri',
      size: 11,
      color: { argb: 'FF0F172A' },
    }
    cell.alignment = { vertical: 'middle', wrapText: index === 6 || index === 9 }
    cell.border = thinBorder
    if (fill) cell.fill = solidFill(fill)
  })
}

function writeMeta(
  sheet: ExcelJS.Worksheet,
  row: number,
  label: string,
  value: string,
) {
  const labelCell = sheet.getCell(row, 1)
  labelCell.value = label
  labelCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } }
  sheet.mergeCells(row, 2, row, COL_COUNT)
  const valueCell = sheet.getCell(row, 2)
  valueCell.value = value
  valueCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } }
}

function buildWorkbook(
  device: Device,
  rows: SheetRow[],
  unassigned: SheetRow[],
  connectedPorts: number,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Documentación de red'
  const sheet = workbook.addWorksheet('Conexiones', {
    views: [{ state: 'frozen', ySplit: 10, showGridLines: false }],
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9,
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      printTitlesRow: '9:10',
      horizontalCentered: true,
      margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.3 },
    },
    headerFooter: {
      oddFooter: `&L${device.name}&CPlanilla de conexiones&R&P / &N`,
    },
  })

  WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })

  sheet.mergeCells(1, 1, 1, COL_COUNT)
  const title = sheet.getCell(1, 1)
  title.value = 'Planilla de conexiones'
  title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
  title.alignment = { vertical: 'middle' }
  title.fill = solidFill(TITLE_FILL)
  applyRangeFill(sheet, 1, 1, COL_COUNT, TITLE_FILL)
  title.value = 'Planilla de conexiones'
  title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
  title.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 28

  const place = formatPlace(device)
  const portCount = device.ports?.length ?? 0
  const freePorts = Math.max(0, portCount - connectedPorts)
  writeMeta(sheet, 2, 'Equipo', device.name)
  writeMeta(sheet, 3, 'Hostname', clean(device.hostname) || '—')
  writeMeta(sheet, 4, 'IP', clean(device.ipAddress) || '—')
  writeMeta(sheet, 5, 'Ubicación', place || '—')
  writeMeta(sheet, 6, 'Generada', DateTime.local().toFormat('dd/MM/yyyy HH:mm'))
  writeMeta(
    sheet,
    7,
    'Resumen',
    `${portCount} puertos · ${connectedPorts} conectados · ${freePorts} libres`,
  )

  writeGroupHeaders(sheet, 9)
  writeColumnHeaders(sheet, 10)

  let cursor = 11
  if (rows.length === 0) {
    sheet.mergeCells(cursor, 1, cursor, COL_COUNT)
    const empty = sheet.getCell(cursor, 1)
    empty.value = 'Este equipo no tiene puertos.'
    empty.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF64748B' } }
    cursor += 1
  } else {
    for (const data of rows) {
      writeDataRow(sheet, cursor, data)
      cursor += 1
    }
    sheet.autoFilter = {
      from: { row: 10, column: 1 },
      to: { row: cursor - 1, column: COL_COUNT },
    }
  }

  if (unassigned.length > 0) {
    cursor += 1
    sheet.mergeCells(cursor, 1, cursor, COL_COUNT)
    const section = sheet.getCell(cursor, 1)
    section.value = 'Enlaces sin puerto asignado'
    section.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF9A3412' } }
    section.fill = solidFill(UNASSIGNED_ROW)
    applyRangeFill(sheet, cursor, 1, COL_COUNT, UNASSIGNED_ROW)
    section.value = 'Enlaces sin puerto asignado'
    section.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF9A3412' } }
    section.alignment = { vertical: 'middle', horizontal: 'left' }
    cursor += 1
    writeGroupHeaders(sheet, cursor)
    cursor += 1
    writeColumnHeaders(sheet, cursor)
    cursor += 1
    for (const data of unassigned) {
      writeDataRow(sheet, cursor, data)
      cursor += 1
    }
  }

  cursor += 1
  sheet.mergeCells(cursor, 1, cursor, COL_COUNT)
  const note = sheet.getCell(cursor, 1)
  note.value = NOTE
  note.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } }
  note.alignment = { wrapText: true, vertical: 'middle' }
  sheet.getRow(cursor).height = 32

  sheet.pageSetup.printArea = `A1:J${cursor}`
  return workbook
}

export default class DeviceConnectionSheetService {
  private devices = new DeviceRepository()
  private links = new DiagramLinkRepository()

  async build(deviceId: string): Promise<DeviceConnectionSheetFile> {
    const device = await this.devices.findByIdOrFail(deviceId)
    const [links, portTypes] = await Promise.all([
      this.links.findActiveForDeviceSheet(device.projectId, device.id),
      PortType.query().select('code', 'name'),
    ])
    const portTypeNames = new Map(portTypes.map((type) => [type.code, type.name]))
    const { rows, unassigned, connectedPorts } = buildRows(device, links, portTypeNames)
    const workbook = buildWorkbook(device, rows, unassigned, connectedPorts)
    const raw = await workbook.xlsx.writeBuffer()
    return {
      buffer: Buffer.from(raw),
      filename: sheetFilename(device.name),
      mimeType: XLSX_MIME,
    }
  }
}
