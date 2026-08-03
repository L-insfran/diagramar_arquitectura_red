import { DateTime } from 'luxon'
import DeviceTemplate from '#models/device_template'
import DeviceTemplatePort from '#models/device_template_port'
import Device from '#models/device'
import DeviceType from '#models/device_type'
import type {
  CreateDeviceTemplateInput,
  CreateDeviceTemplatePortInput,
  DeviceTemplateFilters,
  UpdateDeviceTemplateInput,
  UpdateDeviceTemplatePortInput,
} from '#dtos/device_template_dto'

export default class DeviceTemplateRepository {
  async findAll(filters?: DeviceTemplateFilters) {
    const query = DeviceTemplate.query()
      .whereNull('deleted_at')
      .preload('deviceType')
      .preload('ports', (q) => q.orderBy('port_number', 'asc'))
      .orderBy('name', 'asc')

    if (filters?.deviceTypeId) {
      query.where('device_type_id', filters.deviceTypeId)
    }
    if (filters?.search) {
      query.where((q) => {
        q.whereILike('name', `%${filters.search}%`)
          .orWhereILike('manufacturer', `%${filters.search}%`)
          .orWhereILike('model', `%${filters.search}%`)
      })
    }

    return query
  }

  async findByIdOrFail(id: string) {
    return DeviceTemplate.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('deviceType')
      .preload('ports', (q) => q.orderBy('port_number', 'asc'))
      .firstOrFail()
  }

  async findActiveSummaryOrFail(id: string) {
    return DeviceTemplate.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('deviceType')
      .firstOrFail()
  }

  async findActiveWithPortsOrFail(id: string) {
    return DeviceTemplate.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('deviceType')
      .preload('ports', (q) => q.orderBy('port_number', 'asc'))
      .firstOrFail()
  }

  async create(data: CreateDeviceTemplateInput & { createdBy: string; updatedBy: string }) {
    return DeviceTemplate.create({
      deviceTypeId: data.deviceTypeId,
      name: data.name,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      rackUnits: data.rackUnits ?? null,
      isFullDepth: data.isFullDepth ?? false,
      imageUrl: data.imageUrl ?? null,
      frontViewUrl: data.frontViewUrl ?? null,
      rearViewUrl: data.rearViewUrl ?? null,
      powerConsumptionW: data.powerConsumptionW ?? null,
      weightKg: data.weightKg ?? null,
      customFields: data.customFields ?? {},
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(
    template: DeviceTemplate,
    data: UpdateDeviceTemplateInput & { updatedBy: string }
  ) {
    template.merge({
      ...data,
      customFields: data.customFields === undefined ? template.customFields : (data.customFields ?? {}),
    })
    await template.save()
    return template
  }

  async softDelete(template: DeviceTemplate, deletedBy: string) {
    template.deletedAt = DateTime.now()
    template.deletedBy = deletedBy
    template.updatedBy = deletedBy
    await template.save()
  }

  async countActiveDevices(templateId: string) {
    const row = await Device.query()
      .where('device_template_id', templateId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async findDeviceType(id: string) {
    return DeviceType.find(id)
  }

  async findPortOrFail(templateId: string, portId: string) {
    return DeviceTemplatePort.query()
      .where('id', portId)
      .where('device_template_id', templateId)
      .firstOrFail()
  }

  async createPort(templateId: string, data: CreateDeviceTemplatePortInput) {
    return DeviceTemplatePort.create({
      deviceTemplateId: templateId,
      name: data.name,
      portNumber: data.portNumber,
      portType: data.portType,
      speed: data.speed ?? null,
      description: data.description ?? null,
      isPassthrough: data.isPassthrough ?? false,
      chassisFace: data.chassisFace ?? 'front',
    })
  }

  async updatePort(port: DeviceTemplatePort, data: UpdateDeviceTemplatePortInput) {
    port.merge(data)
    await port.save()
    return port
  }

  async deletePort(port: DeviceTemplatePort) {
    await port.delete()
  }

  async listPorts(templateId: string) {
    return DeviceTemplatePort.query()
      .where('device_template_id', templateId)
      .orderBy('port_number', 'asc')
  }

  /** Sets is_passthrough on every port belonging to the template. */
  async updatePassthroughByTemplateId(
    templateId: string,
    isPassthrough: boolean
  ): Promise<number> {
    const updated = await DeviceTemplatePort.query()
      .where('device_template_id', templateId)
      .update({ isPassthrough })
    return Number(updated)
  }
}
