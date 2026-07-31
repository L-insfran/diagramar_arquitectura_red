import PortRepository, { type BulkPortStatus } from '#repositories/port_repository'

export default class PortService {
  private ports = new PortRepository()

  async bulkUpdateStatus(deviceId: string, status: BulkPortStatus) {
    const updatedCount = await this.ports.updateStatusByDeviceId(deviceId, status)
    return { updatedCount }
  }

  async bulkUpdatePassthrough(deviceId: string, isPassthrough: boolean) {
    const updatedCount = await this.ports.updatePassthroughByDeviceId(deviceId, isPassthrough)
    return { updatedCount }
  }
}
