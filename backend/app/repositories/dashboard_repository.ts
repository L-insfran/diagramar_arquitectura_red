import db from '@adonisjs/lucid/services/db'
import Device from '#models/device'
import Rack from '#models/rack'
import type { DashboardRackSummary, DashboardRecentDevice } from '#dtos/dashboard_dto'

type CountRow = { total: string | number }

async function countWhere(table: string, projectId: string, extra?: (q: any) => void) {
  const query = db.from(table).where('project_id', projectId).count('* as total')
  if (extra) extra(query)
  const row = (await query.first()) as CountRow | null
  return Number(row?.total ?? 0)
}

export default class DashboardRepository {
  async countDevicesByStatus(projectId: string) {
    const rows = await db
      .from('devices')
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .groupBy('status')
      .select('status')
      .count('* as total')

    const map: Record<string, number> = {}
    for (const row of rows as Array<{ status: string; total: string | number }>) {
      map[row.status] = Number(row.total)
    }
    return map
  }

  countDevices(projectId: string) {
    return countWhere('devices', projectId, (q) => q.whereNull('deleted_at'))
  }

  countRacks(projectId: string) {
    return countWhere('racks', projectId, (q) => q.whereNull('deleted_at'))
  }

  countSites(projectId: string) {
    return countWhere('sites', projectId, (q) => q.whereNull('deleted_at'))
  }

  async countAreas(projectId: string) {
    const row = (await db
      .from('areas')
      .join('sites', 'sites.id', 'areas.site_id')
      .where('sites.project_id', projectId)
      .whereNull('areas.deleted_at')
      .whereNull('sites.deleted_at')
      .count('* as total')
      .first()) as CountRow | null
    return Number(row?.total ?? 0)
  }

  countVlans(projectId: string) {
    return countWhere('vlans', projectId)
  }

  countNetworks(projectId: string) {
    return countWhere('networks', projectId)
  }

  countConnections(projectId: string, physicalOnly = false) {
    return countWhere('connections', projectId, (q) => {
      q.whereNull('deleted_at')
      if (physicalOnly) q.where('connection_type', 'physical')
    })
  }

  countAttachments(projectId: string) {
    return countWhere('attachments', projectId, (q) => q.whereNull('deleted_at'))
  }

  countSecrets(projectId: string) {
    return countWhere('secrets', projectId, (q) => q.whereNull('deleted_at'))
  }

  async countPorts(projectId: string) {
    const row = (await db
      .from('ports')
      .join('devices', 'devices.id', 'ports.device_id')
      .where('devices.project_id', projectId)
      .whereNull('devices.deleted_at')
      .count('* as total')
      .first()) as CountRow | null
    return Number(row?.total ?? 0)
  }

  /**
   * Distinct ports that appear in at least one active physical connection
   * for devices of this project.
   */
  async countOccupiedPorts(projectId: string) {
    const source = db
      .from('connections as c')
      .join('ports as p', 'p.id', 'c.source_port_id')
      .join('devices as d', 'd.id', 'p.device_id')
      .where('c.project_id', projectId)
      .whereNull('c.deleted_at')
      .where('c.connection_type', 'physical')
      .whereNull('d.deleted_at')
      .select('p.id')

    const target = db
      .from('connections as c')
      .join('ports as p', 'p.id', 'c.target_port_id')
      .join('devices as d', 'd.id', 'p.device_id')
      .where('c.project_id', projectId)
      .whereNull('c.deleted_at')
      .where('c.connection_type', 'physical')
      .whereNull('d.deleted_at')
      .select('p.id')

    const row = (await db
      .from(source.union(target).as('occupied'))
      .countDistinct('id as total')
      .first()) as CountRow | null
    return Number(row?.total ?? 0)
  }

  async countDevicesWithoutAttachments(projectId: string) {
    const row = (await db
      .from('devices as d')
      .where('d.project_id', projectId)
      .whereNull('d.deleted_at')
      .whereNotExists((q) => {
        q.from('attachments as a')
          .whereRaw('a.attachable_id = d.id')
          .where('a.attachable_type', 'device')
          .where('a.project_id', projectId)
          .whereNull('a.deleted_at')
      })
      .count('* as total')
      .first()) as CountRow | null
    return Number(row?.total ?? 0)
  }

  /**
   * Devices that have at least one port but no active physical connection
   * on any of their ports.
   */
  async countDevicesWithoutPhysicalLink(projectId: string) {
    const row = (await db
      .from('devices as d')
      .where('d.project_id', projectId)
      .whereNull('d.deleted_at')
      .whereExists((q) => {
        q.from('ports as p').whereRaw('p.device_id = d.id')
      })
      .whereNotExists((q) => {
        q.from('connections as c')
          .join('ports as p', (join) => {
            join.on('p.id', 'c.source_port_id').orOn('p.id', 'c.target_port_id')
          })
          .whereRaw('p.device_id = d.id')
          .whereNull('c.deleted_at')
          .where('c.connection_type', 'physical')
      })
      .count('* as total')
      .first()) as CountRow | null
    return Number(row?.total ?? 0)
  }

  async listRacksWithMounted(projectId: string) {
    const racks = await Rack.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .orderBy('name', 'asc')

    const mounted = await Device.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .whereNotNull('rack_id')
      .whereNotNull('rack_unit_start')
      .preload('deviceTemplate')

    return { racks, mounted }
  }

  async listRecentDevices(projectId: string, limit = 5): Promise<DashboardRecentDevice[]> {
    const rows = await Device.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('deviceType')
      .orderBy('updated_at', 'desc')
      .limit(limit)

    return rows.map((d) => ({
      id: d.id,
      name: d.name,
      status: d.status,
      ipAddress: d.ipAddress,
      deviceTypeName: d.deviceType?.name ?? null,
      updatedAt: d.updatedAt?.toISO() ?? null,
    }))
  }

  async listOfflineDevices(projectId: string) {
    return Device.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .where('status', 'offline')
      .orderBy('name', 'asc')
      .limit(20)
  }

  async listUndocumentedDeviceIds(projectId: string, limit = 10) {
    const rows = await db
      .from('devices as d')
      .where('d.project_id', projectId)
      .whereNull('d.deleted_at')
      .whereNotExists((q) => {
        q.from('attachments as a')
          .whereRaw('a.attachable_id = d.id')
          .where('a.attachable_type', 'device')
          .where('a.project_id', projectId)
          .whereNull('a.deleted_at')
      })
      .select('d.id', 'd.name')
      .orderBy('d.name', 'asc')
      .limit(limit)
    return rows as Array<{ id: string; name: string }>
  }

  buildRackSummaries(
    racks: Rack[],
    mounted: Device[]
  ): { items: DashboardRackSummary[]; usedU: number; totalCapacityU: number } {
    const byRack = new Map<string, Device[]>()
    for (const d of mounted) {
      if (!d.rackId) continue
      const list = byRack.get(d.rackId) ?? []
      list.push(d)
      byRack.set(d.rackId, list)
    }

    let usedU = 0
    let totalCapacityU = 0
    const items: DashboardRackSummary[] = []

    for (const rack of racks) {
      const capacity = rack.heightU * 2
      totalCapacityU += capacity
      const usedUnits = new Set<string>()
      for (const d of byRack.get(rack.id) ?? []) {
        const height = Math.max(1, d.deviceTemplate?.rackUnits ?? 1)
        const start = d.rackUnitStart ?? 1
        const face = d.rackFace ?? 'front'
        for (let u = start; u < start + height; u++) {
          usedUnits.add(`${face}:${u}`)
        }
      }
      const rackUsed = usedUnits.size
      usedU += rackUsed
      const freeU = Math.max(0, capacity - rackUsed)
      items.push({
        id: rack.id,
        name: rack.name,
        code: rack.code,
        heightU: rack.heightU,
        usedU: rackUsed,
        freeU,
        percentUsed: capacity === 0 ? 0 : Math.round((rackUsed / capacity) * 1000) / 10,
      })
    }

    return { items, usedU, totalCapacityU }
  }
}
