import type { Device } from '../types'

export const UNSET_TEMPLATE_ID = '__none__'

const LOCALE_COMPARE_OPTS: Intl.CollatorOptions = { sensitivity: 'base', numeric: true }

export type DeviceInventoryInstance = {
  id: string
  name: string
  status: Device['status']
}

export type DeviceStatusCounts = {
  online: number
  offline: number
  maintenance: number
  unknown: number
}

export type DeviceInventoryRow = {
  templateId: string
  templateName: string
  deviceTypeName: string
  manufacturer: string
  model: string
  count: number
  byStatus: DeviceStatusCounts
  devices: DeviceInventoryInstance[]
}

export type DeviceInventorySummary = {
  rows: DeviceInventoryRow[]
  deviceCount: number
  templateCount: number
  typeCount: number
}

function emptyStatus(): DeviceStatusCounts {
  return { online: 0, offline: 0, maintenance: 0, unknown: 0 }
}

function dash(value: string | null | undefined): string {
  const trimmed = value?.trim()
  return trimmed ? trimmed : '—'
}

export function groupDevicesByTemplate(devices: Device[]): DeviceInventorySummary {
  const map = new Map<string, DeviceInventoryRow>()

  for (const device of devices) {
    const templateId = device.deviceTemplateId || UNSET_TEMPLATE_ID
    let row = map.get(templateId)
    if (!row) {
      row = {
        templateId,
        templateName:
          device.deviceTemplate?.name?.trim() ||
          (templateId === UNSET_TEMPLATE_ID ? 'Sin template' : '—'),
        deviceTypeName: dash(device.deviceType?.name),
        manufacturer: dash(device.deviceTemplate?.manufacturer ?? device.manufacturer),
        model: dash(device.deviceTemplate?.model ?? device.model),
        count: 0,
        byStatus: emptyStatus(),
        devices: [],
      }
      map.set(templateId, row)
    }
    row.count += 1
    row.byStatus[device.status] += 1
    row.devices.push({ id: device.id, name: device.name, status: device.status })
  }

  const rows = [...map.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.templateName.localeCompare(b.templateName, 'es', LOCALE_COMPARE_OPTS)
  })

  for (const row of rows) {
    row.devices.sort((a, b) => a.name.localeCompare(b.name, 'es', LOCALE_COMPARE_OPTS))
  }

  const types = new Set(rows.map((r) => r.deviceTypeName))

  return {
    rows,
    deviceCount: devices.length,
    templateCount: rows.length,
    typeCount: types.size,
  }
}

export const INVENTORY_CSV_HEADERS = [
  'Tipo',
  'Template',
  'Fabricante',
  'Modelo',
  'Cantidad',
  'Online',
  'Offline',
  'Maintenance',
  'Unknown',
] as const

export function inventoryRowsToCsvRecords(
  rows: DeviceInventoryRow[],
): Array<Record<string, string | number>> {
  return rows.map((row) => ({
    Tipo: row.deviceTypeName,
    Template: row.templateName,
    Fabricante: row.manufacturer,
    Modelo: row.model,
    Cantidad: row.count,
    Online: row.byStatus.online,
    Offline: row.byStatus.offline,
    Maintenance: row.byStatus.maintenance,
    Unknown: row.byStatus.unknown,
  }))
}
