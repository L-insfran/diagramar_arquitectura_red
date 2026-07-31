import { Exception } from '@adonisjs/core/exceptions'
import Device from '#models/device'
import DeviceTemplateRepository from '#repositories/device_template_repository'
import type {
  CreateDeviceTemplateInput,
  CreateDeviceTemplatePortInput,
  DeviceTemplateFilters,
  UpdateDeviceTemplateInput,
  UpdateDeviceTemplatePortInput,
} from '#dtos/device_template_dto'

export default class DeviceTemplateService {
  private templates = new DeviceTemplateRepository()

  async getAll(filters?: DeviceTemplateFilters) {
    return this.templates.findAll(filters)
  }

  async getById(id: string) {
    return this.templates.findByIdOrFail(id)
  }

  async getActiveSummary(id: string) {
    return this.templates.findActiveSummaryOrFail(id)
  }

  /** Used by DeviceService when instantiating. */
  async getActiveWithPorts(id: string) {
    return this.templates.findActiveWithPortsOrFail(id)
  }

  async create(data: CreateDeviceTemplateInput, actorId: string) {
    const type = await this.templates.findDeviceType(data.deviceTypeId)
    if (!type) {
      throw new Exception('Device type not found', { status: 422 })
    }
    const template = await this.templates.create({
      ...data,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.templates.findByIdOrFail(template.id)
  }

  async update(id: string, data: UpdateDeviceTemplateInput, actorId: string) {
    const template = await this.templates.findActiveSummaryOrFail(id)
    if (data.deviceTypeId) {
      const type = await this.templates.findDeviceType(data.deviceTypeId)
      if (!type) {
        throw new Exception('Device type not found', { status: 422 })
      }
    }
    await this.templates.update(template, { ...data, updatedBy: actorId })

    // Keep denormalized manufacturer/model/type on active instances in sync
    if (
      data.manufacturer !== undefined ||
      data.model !== undefined ||
      data.deviceTypeId !== undefined
    ) {
      const devices = await Device.query()
        .where('device_template_id', id)
        .whereNull('deleted_at')
      for (const device of devices) {
        if (data.manufacturer !== undefined) device.manufacturer = data.manufacturer ?? null
        if (data.model !== undefined) device.model = data.model ?? null
        if (data.deviceTypeId !== undefined) device.deviceTypeId = data.deviceTypeId
        device.updatedBy = actorId
        await device.save()
      }
    }

    return this.templates.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const template = await this.templates.findActiveSummaryOrFail(id)
    const activeCount = await this.templates.countActiveDevices(id)
    if (activeCount > 0) {
      throw new Exception(
        `No se puede eliminar el template: hay ${activeCount} dispositivo(s) activo(s) que lo usan`,
        { status: 409 }
      )
    }
    await this.templates.softDelete(template, actorId)
  }

  async listPorts(templateId: string) {
    await this.templates.findActiveSummaryOrFail(templateId)
    return this.templates.listPorts(templateId)
  }

  async createPort(templateId: string, data: CreateDeviceTemplatePortInput) {
    await this.templates.findActiveSummaryOrFail(templateId)
    return this.templates.createPort(templateId, data)
  }

  async updatePort(
    templateId: string,
    portId: string,
    data: UpdateDeviceTemplatePortInput
  ) {
    await this.templates.findActiveSummaryOrFail(templateId)
    const port = await this.templates.findPortOrFail(templateId, portId)
    return this.templates.updatePort(port, data)
  }

  async deletePort(templateId: string, portId: string) {
    await this.templates.findActiveSummaryOrFail(templateId)
    const port = await this.templates.findPortOrFail(templateId, portId)
    await this.templates.deletePort(port)
  }

  async bulkUpdatePortsPassthrough(templateId: string, isPassthrough: boolean) {
    await this.templates.findActiveSummaryOrFail(templateId)
    const updatedCount = await this.templates.updatePassthroughByTemplateId(
      templateId,
      isPassthrough
    )
    return { updatedCount }
  }
}
