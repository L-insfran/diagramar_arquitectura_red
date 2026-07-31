import Port from '#models/port'

export type BulkPortStatus = 'up' | 'down'

export default class PortRepository {
  /**
   * Sets status on every port belonging to the device.
   * Returns the number of rows affected by the UPDATE.
   */
  async updateStatusByDeviceId(deviceId: string, status: BulkPortStatus): Promise<number> {
    const updated = await Port.query().where('device_id', deviceId).update({ status })
    return Number(updated)
  }

  /** Sets is_passthrough on every port belonging to the device. */
  async updatePassthroughByDeviceId(deviceId: string, isPassthrough: boolean): Promise<number> {
    const updated = await Port.query()
      .where('device_id', deviceId)
      .update({ isPassthrough })
    return Number(updated)
  }
}
