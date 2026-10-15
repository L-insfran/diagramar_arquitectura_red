import { Exception } from '@adonisjs/core/exceptions'
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
const GROUP_NOTE =
  'Esta planilla reúne varios equipos. Cada bloque es un equipo: la banda indica nombre, hostname, IP y ubicación. Cada fila es un puerto; el destino es el otro extremo del enlace documentado.'
const INDEX_NOTE =
  'Cada hoja siguiente es la planilla de un equipo, con el mismo contenido que la descarga individual.'
const GROUP_FILENAME = 'conexiones-grupo.xlsx'
const GROUP_MAX = 60
const BAND_FILL = 'FF1E293B'

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
  columns = COL_COUNT,
) {
  const labelCell = sheet.getCell(row, 1)
  labelCell.value = label
  labelCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF334155' } }
  sheet.mergeCells(row, 2, row, columns)
  const valueCell = sheet.getCell(row, 2)
  valueCell.value = value
  valueCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF0F172A' } }
}

type DeviceSheetBlock = {
  device: Device
  rows: SheetRow[]
  unassigned: SheetRow[]
  connectedPorts: number
}

export type ConnectionSheetLayout = 'tabs' | 'combined'

function deviceSummary(block: DeviceSheetBlock): string {
  const portCount = block.device.ports?.length ?? 0
  const freePorts = Math.max(0, portCount - block.connectedPorts)
  return `${portCount} puertos · ${block.connectedPorts} conectados · ${freePorts} libres`
}

function sortDevices(devices: Device[]): Device[] {
  return [...devices].sort(
    (a, b) => a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id),
  )
}

function excelSheetName(name: string, used: Set<string>): string {
  const cleaned = name.replace(/[\\/?*[\]:]/g, ' ').replace(/\s+/g, ' ').trim()
  const base = (cleaned || 'Equipo').slice(0, 31)
  let candidate = base
  let n = 2
  while (used.has(candidate.toLocaleLowerCase('es'))) {
    const suffix = ` ${n}`
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`
    n += 1
  }
  used.add(candidate.toLocaleLowerCase('es'))
  return candidate
}

function landscapePageSetup(printTitlesRow?: string): Partial<ExcelJS.PageSetup> {
  const setup: Partial<ExcelJS.PageSetup> = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.4, right: 0.4, top: 0.6, bottom: 0.6, header: 0.2, footer: 0.3 },
  }
  if (printTitlesRow) setup.printTitlesRow = printTitlesRow
  return setup
}

function writeTitle(sheet: ExcelJS.Worksheet, value: string, columns = COL_COUNT) {
  sheet.mergeCells(1, 1, 1, columns)
  applyRangeFill(sheet, 1, 1, columns, TITLE_FILL)
  const title = sheet.getCell(1, 1)
  title.value = value
  title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FFFFFFFF' } }
  title.alignment = { vertical: 'middle', horizontal: 'left' }
  sheet.getRow(1).height = 28
}

function writeNote(sheet: ExcelJS.Worksheet, row: number, value: string, columns = COL_COUNT) {
  sheet.mergeCells(row, 1, row, columns)
  const note = sheet.getCell(row, 1)
  note.value = value
  note.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } }
  note.alignment = { wrapText: true, vertical: 'middle' }
  sheet.getRow(row).height = 32
}

function writeBand(sheet: ExcelJS.Worksheet, row: number, value: string) {
  sheet.mergeCells(row, 1, row, COL_COUNT)
  applyRangeFill(sheet, row, 1, COL_COUNT, BAND_FILL)
  const cell = sheet.getCell(row, 1)
  cell.value = value
  cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
  cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
  sheet.getRow(row).height = 24
}

function writeUnassignedSection(
  sheet: ExcelJS.Worksheet,
  cursor: number,
  unassigned: SheetRow[],
): number {
  let row = cursor + 1
  sheet.mergeCells(row, 1, row, COL_COUNT)
  applyRangeFill(sheet, row, 1, COL_COUNT, UNASSIGNED_ROW)
  const section = sheet.getCell(row, 1)
  section.value = 'Enlaces sin puerto asignado'
  section.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF9A3412' } }
  section.alignment = { vertical: 'middle', horizontal: 'left' }
  row += 1
  writeGroupHeaders(sheet, row)
  row += 1
  writeColumnHeaders(sheet, row)
  row += 1
  for (const data of unassigned) {
    writeDataRow(sheet, row, data)
    row += 1
  }
  return row
}

function addDeviceWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  device: Device,
  rows: SheetRow[],
  unassigned: SheetRow[],
  connectedPorts: number,
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 10, showGridLines: false }],
    pageSetup: landscapePageSetup('9:10'),
    headerFooter: {
      oddFooter: `&L${device.name}&CPlanilla de conexiones&R&P / &N`,
    },
  })

  WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })

  writeTitle(sheet, 'Planilla de conexiones')

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
    cursor = writeUnassignedSection(sheet, cursor, unassigned)
  }

  cursor += 1
  writeNote(sheet, cursor, NOTE)

  sheet.pageSetup.printArea = `A1:J${cursor}`
  return sheet
}

function buildWorkbook(
  device: Device,
  rows: SheetRow[],
  unassigned: SheetRow[],
  connectedPorts: number,
): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Documentación de red'
  addDeviceWorksheet(workbook, 'Conexiones', device, rows, unassigned, connectedPorts)
  return workbook
}

function deviceBand(block: DeviceSheetBlock): string {
  const place = formatPlace(block.device)
  return [
    block.device.name,
    clean(block.device.hostname) || 'sin hostname',
    clean(block.device.ipAddress) || 'sin IP',
    place || 'sin ubicación',
    deviceSummary(block),
  ].join('  ·  ')
}

function writeDeviceBlock(sheet: ExcelJS.Worksheet, cursor: number, block: DeviceSheetBlock): number {
  writeBand(sheet, cursor, deviceBand(block))
  let row = cursor + 1
  writeGroupHeaders(sheet, row)
  row += 1
  writeColumnHeaders(sheet, row)
  row += 1
  if (block.rows.length === 0) {
    sheet.mergeCells(row, 1, row, COL_COUNT)
    const empty = sheet.getCell(row, 1)
    empty.value = 'Este equipo no tiene puertos.'
    empty.font = { name: 'Calibri', size: 11, italic: true, color: { argb: 'FF64748B' } }
    row += 1
  } else {
    for (const data of block.rows) {
      writeDataRow(sheet, row, data)
      row += 1
    }
  }
  if (block.unassigned.length > 0) {
    row = writeUnassignedSection(sheet, row, block.unassigned)
  }
  return row + 1
}

function buildCombinedWorkbook(blocks: DeviceSheetBlock[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Documentación de red'
  const sheet = workbook.addWorksheet('Conexiones', {
    views: [{ state: 'frozen', ySplit: 4, showGridLines: false }],
    pageSetup: landscapePageSetup(),
    headerFooter: {
      oddFooter: '&LPlanilla de conexiones&CVarios equipos&R&P / &N',
    },
  })
  WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
  writeTitle(sheet, 'Planilla de conexiones')
  const portCount = blocks.reduce((sum, block) => sum + (block.device.ports?.length ?? 0), 0)
  const connected = blocks.reduce((sum, block) => sum + block.connectedPorts, 0)
  const free = Math.max(0, portCount - connected)
  writeMeta(sheet, 2, 'Generada', DateTime.local().toFormat('dd/MM/yyyy HH:mm'))
  writeMeta(
    sheet,
    3,
    'Resumen',
    `${blocks.length} equipos · ${portCount} puertos · ${connected} conectados · ${free} libres`,
  )

  let cursor = 5
  for (const block of blocks) {
    cursor = writeDeviceBlock(sheet, cursor, block)
  }
  writeNote(sheet, cursor, GROUP_NOTE)
  sheet.pageSetup.printArea = `A1:J${cursor}`
  return workbook
}

const INDEX_HEADERS = [
  'Equipo',
  'Hostname',
  'IP',
  'Ubicación',
  'Puertos',
  'Conectados',
  'Libres',
  'Hoja',
] as const
const INDEX_WIDTHS = [28, 24, 18, 36, 12, 14, 12, 28]

function buildTabsWorkbook(blocks: DeviceSheetBlock[]): ExcelJS.Workbook {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'Documentación de red'
  const used = new Set<string>(['índice'])
  const sheetNames = new Map(
    blocks.map((block) => [block.device.id, excelSheetName(block.device.name, used)]),
  )

  const index = workbook.addWorksheet('Índice', {
    views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
    pageSetup: landscapePageSetup(),
    headerFooter: {
      oddFooter: '&LÍndice de equipos&CPlanilla de conexiones&R&P / &N',
    },
  })
  INDEX_WIDTHS.forEach((width, column) => {
    index.getColumn(column + 1).width = width
  })
  writeTitle(index, 'Índice de equipos', INDEX_HEADERS.length)
  writeMeta(index, 2, 'Generada', DateTime.local().toFormat('dd/MM/yyyy HH:mm'), INDEX_HEADERS.length)
  writeMeta(index, 3, 'Resumen', `${blocks.length} equipos`, INDEX_HEADERS.length)
  INDEX_HEADERS.forEach((header, column) => {
    const cell = index.getCell(5, column + 1)
    cell.value = header
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } }
    cell.fill = solidFill(ORIGIN_HEADER)
    cell.alignment = { horizontal: 'left', vertical: 'middle' }
    cell.border = thinBorder
  })
  index.getRow(5).height = 20

  blocks.forEach((block, indexRow) => {
    const row = 6 + indexRow
    const portCount = block.device.ports?.length ?? 0
    const freePorts = Math.max(0, portCount - block.connectedPorts)
    const sheetName = sheetNames.get(block.device.id) ?? 'Equipo'
    const values: Array<string | number | { text: string; hyperlink: string }> = [
      block.device.name,
      clean(block.device.hostname) || '—',
      clean(block.device.ipAddress) || '—',
      formatPlace(block.device) || '—',
      portCount,
      block.connectedPorts,
      freePorts,
      {
        text: sheetName,
        hyperlink: `#'${sheetName.replace(/'/g, "''")}'!A1`,
      },
    ]
    values.forEach((value, column) => {
      const cell = index.getCell(row, column + 1)
      cell.value = value
      cell.font = {
        name: 'Calibri',
        size: 11,
        color: { argb: column === 7 ? 'FF1D4ED8' : 'FF0F172A' },
        underline: column === 7,
      }
      cell.alignment = { vertical: 'middle' }
      cell.border = thinBorder
    })
  })

  const lastRow = 6 + blocks.length
  writeNote(index, lastRow, INDEX_NOTE, INDEX_HEADERS.length)
  index.pageSetup.printArea = `A1:H${lastRow}`
  if (blocks.length > 0) {
    index.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5 + blocks.length, column: 8 } }
  }

  for (const block of blocks) {
    addDeviceWorksheet(
      workbook,
      sheetNames.get(block.device.id) ?? 'Equipo',
      block.device,
      block.rows,
      block.unassigned,
      block.connectedPorts,
    )
  }
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

  async buildGroup(
    projectId: string,
    deviceIds: string[],
    layout: ConnectionSheetLayout,
  ): Promise<DeviceConnectionSheetFile> {
    const ids = [...new Set(deviceIds)]
    if (ids.length === 0 || ids.length > GROUP_MAX) {
      throw new Exception('Elegí entre 1 y 60 equipos', { status: 422 })
    }

    const [found, allLinks, portTypes] = await Promise.all([
      this.devices.findActiveForSheetByIds(projectId, ids),
      this.links.findActiveForDevicesSheet(projectId, ids),
      PortType.query().select('code', 'name'),
    ])
    if (found.length !== ids.length) {
      throw new Exception('Alguno de los equipos no pertenece al proyecto o no existe', {
        status: 422,
      })
    }

    const portTypeNames = new Map(portTypes.map((type) => [type.code, type.name]))
    const linksByDevice = new Map<string, DiagramLink[]>(ids.map((id) => [id, []]))
    for (const link of allLinks) {
      const sourceBucket = linksByDevice.get(link.sourceDeviceId)
      if (sourceBucket) sourceBucket.push(link)
      if (link.targetDeviceId !== link.sourceDeviceId) {
        const targetBucket = linksByDevice.get(link.targetDeviceId)
        if (targetBucket) targetBucket.push(link)
      }
    }

    const blocks: DeviceSheetBlock[] = sortDevices(found).map((device) => {
      const built = buildRows(device, linksByDevice.get(device.id) ?? [], portTypeNames)
      return { device, ...built }
    })
    const workbook =
      layout === 'tabs' ? buildTabsWorkbook(blocks) : buildCombinedWorkbook(blocks)
    const raw = await workbook.xlsx.writeBuffer()
    return {
      buffer: Buffer.from(raw),
      filename: GROUP_FILENAME,
      mimeType: XLSX_MIME,
    }
  }
}
