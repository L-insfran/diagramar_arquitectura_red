import DashboardRepository from '#repositories/dashboard_repository'
import type { DashboardAlert, DashboardMetrics } from '#dtos/dashboard_dto'

const RACK_OCCUPANCY_WARN = 80
const RACK_OCCUPANCY_CRIT = 95

export default class DashboardService {
  private repo = new DashboardRepository()

  async getMetrics(projectId: string): Promise<DashboardMetrics> {
    const [
      statusMap,
      devices,
      racks,
      sites,
      areas,
      ports,
      portsOccupied,
      connections,
      connectionsPhysical,
      vlans,
      networks,
      attachments,
      secrets,
      devicesWithoutAttachments,
      devicesWithoutPhysicalLink,
      rackData,
      recentDevices,
      offlineDevices,
      undocumented,
    ] = await Promise.all([
      this.repo.countDevicesByStatus(projectId),
      this.repo.countDevices(projectId),
      this.repo.countRacks(projectId),
      this.repo.countSites(projectId),
      this.repo.countAreas(projectId),
      this.repo.countPorts(projectId),
      this.repo.countOccupiedPorts(projectId),
      this.repo.countConnections(projectId, false),
      this.repo.countConnections(projectId, true),
      this.repo.countVlans(projectId),
      this.repo.countNetworks(projectId),
      this.repo.countAttachments(projectId),
      this.repo.countSecrets(projectId),
      this.repo.countDevicesWithoutAttachments(projectId),
      this.repo.countDevicesWithoutPhysicalLink(projectId),
      this.repo.listRacksWithMounted(projectId),
      this.repo.listRecentDevices(projectId, 5),
      this.repo.listOfflineDevices(projectId),
      this.repo.listUndocumentedDeviceIds(projectId, 8),
    ])

    const portsFree = Math.max(0, ports - portsOccupied)
    const { items: rackItems, usedU, totalCapacityU } = this.repo.buildRackSummaries(
      rackData.racks,
      rackData.mounted
    )
    const freeU = Math.max(0, totalCapacityU - usedU)
    const percentUsed =
      totalCapacityU === 0 ? 0 : Math.round((usedU / totalCapacityU) * 1000) / 10

    const alerts: DashboardAlert[] = []

    for (const d of offlineDevices) {
      alerts.push({
        severity: 'critical',
        code: 'device_offline',
        message: `Equipo offline: ${d.name}`,
        entityType: 'device',
        entityId: d.id,
      })
    }

    for (const d of undocumented) {
      alerts.push({
        severity: 'warning',
        code: 'device_undocumented',
        message: `Sin documentación adjunta: ${d.name}`,
        entityType: 'device',
        entityId: d.id,
      })
    }

    if (devicesWithoutPhysicalLink > 0) {
      alerts.push({
        severity: 'warning',
        code: 'devices_unlinked',
        message: `${devicesWithoutPhysicalLink} equipo(s) con puertos pero sin conexión física`,
        entityType: 'device',
      })
    }

    for (const rack of rackItems) {
      if (rack.percentUsed >= RACK_OCCUPANCY_CRIT) {
        alerts.push({
          severity: 'critical',
          code: 'rack_full',
          message: `Rack casi lleno: ${rack.name} (${rack.percentUsed}%)`,
          entityType: 'rack',
          entityId: rack.id,
        })
      } else if (rack.percentUsed >= RACK_OCCUPANCY_WARN) {
        alerts.push({
          severity: 'warning',
          code: 'rack_high_occupancy',
          message: `Alta ocupación de rack: ${rack.name} (${rack.percentUsed}%)`,
          entityType: 'rack',
          entityId: rack.id,
        })
      }
    }

    if (ports > 0 && portsFree === 0) {
      alerts.push({
        severity: 'info',
        code: 'ports_exhausted',
        message: 'No quedan puertos libres en el proyecto',
      })
    }

    return {
      counts: {
        devices,
        devicesOnline: statusMap.online ?? 0,
        devicesOffline: statusMap.offline ?? 0,
        devicesMaintenance: statusMap.maintenance ?? 0,
        racks,
        sites,
        areas,
        ports,
        portsFree,
        portsOccupied,
        connections,
        connectionsPhysical,
        vlans,
        networks,
        attachments,
        secrets,
      },
      racks: {
        totalCapacityU,
        usedU,
        freeU,
        percentUsed,
        items: rackItems,
      },
      documentation: {
        devicesWithoutAttachments,
        devicesWithoutPhysicalLink,
      },
      alerts,
      recentDevices,
    }
  }
}
