import { Exception } from '@adonisjs/core/exceptions'
import PortRepository, { type BulkPortStatus } from '#repositories/port_repository'

export type PortOperationalStatus = 'up' | 'down' | 'disabled'

const PASSTHROUGH_STATUS_MESSAGE = 'Un puerto puente siempre está Up'

export default class PortService {
  private ports = new PortRepository()

  /**
   * Domain rule: passthrough (patch panel / bridge) ports are always up.
   * Force on create; callers that update must use assertPassthroughStatusAllowed.
   */
  resolveStatusForCreate(
    isPassthrough: boolean,
    requestedStatus?: PortOperationalStatus | null
  ): PortOperationalStatus {
    if (isPassthrough) return 'up'
    return requestedStatus ?? 'down'
  }

  /**
   * Rejects attempts to set down/disabled on a port that is (or will be) passthrough.
   */
  assertPassthroughStatusAllowed(
    isPassthrough: boolean,
    requestedStatus: PortOperationalStatus | undefined
  ): void {
    if (!isPassthrough || requestedStatus === undefined) return
    if (requestedStatus !== 'up') {
      throw new Exception(PASSTHROUGH_STATUS_MESSAGE, { status: 422 })
    }
  }

  async bulkUpdateStatus(deviceId: string, status: BulkPortStatus) {
    const updatedCount = await this.ports.updateStatusByDeviceId(deviceId, status)
    return { updatedCount }
  }

  async bulkUpdatePassthrough(deviceId: string, isPassthrough: boolean) {
    const updatedCount = await this.ports.updatePassthroughByDeviceId(deviceId, isPassthrough)
    return { updatedCount }
  }
}
