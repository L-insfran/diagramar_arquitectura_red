import Port from '#models/port'

export type BulkPortStatus = 'up' | 'down'

export default class PortRepository {
  /**
   * Sets status on ports of the device.
   * When status is `down`, passthrough ports are excluded (they must stay up).
   * Returns the number of rows affected by the UPDATE.
   */
  async updateStatusByDeviceId(deviceId: string, status: BulkPortStatus): Promise<number> {
    const query = Port.query().where('device_id', deviceId)
    if (status === 'down') {
      query.where('is_passthrough', false)
    }
    const updated = await query.update({ status })
    return Number(updated)
  }

  /**
   * Sets is_passthrough on every port belonging to the device.
   * When enabling passthrough, also forces status = up.
   */
  async updatePassthroughByDeviceId(deviceId: string, isPassthrough: boolean): Promise<number> {
    const patch: { isPassthrough: boolean; status?: 'up' } = { isPassthrough }
    if (isPassthrough) {
      patch.status = 'up'
    }
    const updated = await Port.query().where('device_id', deviceId).update(patch)
    return Number(updated)
  }
}
