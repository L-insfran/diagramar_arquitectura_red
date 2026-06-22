import Device from '#models/device'

export default class DeviceService {
  async getAllByCompany(companyId: string, filters?: { status?: string; deviceTypeId?: string; search?: string }) {
    const query = Device.query()
      .where('company_id', companyId)
      .preload('deviceType')
      .preload('ports', (q) => q.orderBy('port_number', 'asc'))
      .orderBy('name', 'asc')

    if (filters?.status) {
      query.where('status', filters.status)
    }
    if (filters?.deviceTypeId) {
      query.where('device_type_id', filters.deviceTypeId)
    }
    if (filters?.search) {
      query.where((q) => {
        q.whereILike('name', `%${filters.search}%`)
          .orWhereILike('ip_address', `%${filters.search}%`)
          .orWhereILike('hostname', `%${filters.search}%`)
      })
    }

    return query
  }

  async getById(id: string) {
    return Device.query()
      .where('id', id)
      .preload('deviceType')
      .preload('ports', (q) => q.orderBy('port_number', 'asc'))
      .preload('credentials')
      .preload('employees')
      .firstOrFail()
  }

  async create(data: Partial<Device>) {
    return Device.create(data)
  }

  async update(id: string, data: Partial<Device>) {
    const device = await Device.findOrFail(id)
    device.merge(data)
    await device.save()
    return device
  }

  async delete(id: string) {
    const device = await Device.findOrFail(id)
    await device.delete()
  }
}
