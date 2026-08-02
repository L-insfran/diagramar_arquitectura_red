import { DateTime } from 'luxon'
import RackAccessory from '#models/rack_accessory'
import Device from '#models/device'
import type {
  CreateRackAccessoryInput,
  RackAccessoryFilters,
  UpdateRackAccessoryInput,
} from '#dtos/rack_accessory_dto'

export default class RackAccessoryRepository {
  async findAllByProject(projectId: string, filters?: RackAccessoryFilters) {
    const query = RackAccessory.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('rack', (q) => q.preload('area', (a) => a.preload('site')))
      .preload('accessoryTemplate')
      .orderBy('unit_start', 'asc')
      .orderBy('name', 'asc')

    if (filters?.rackId) {
      query.where('rack_id', filters.rackId)
    }
    if (filters?.kind) {
      query.where('kind', filters.kind)
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
    return RackAccessory.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('rack', (q) => q.preload('area', (a) => a.preload('site')))
      .preload('accessoryTemplate')
      .preload('supportedDevices', (q) =>
        q.whereNull('deleted_at').preload('deviceTemplate').orderBy('shelf_slot_start', 'asc')
      )
      .firstOrFail()
  }

  async findSummaryOrFail(id: string) {
    return RackAccessory.query().where('id', id).whereNull('deleted_at').preload('rack').firstOrFail()
  }

  async findActiveInProject(id: string, projectId: string) {
    return RackAccessory.query()
      .where('id', id)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('rack', (q) => q.preload('area'))
      .first()
  }

  async findByRack(rackId: string) {
    return RackAccessory.query()
      .where('rack_id', rackId)
      .whereNull('deleted_at')
      .orderBy('unit_start', 'asc')
  }

  async create(data: CreateRackAccessoryInput & { createdBy: string; updatedBy: string }) {
    return RackAccessory.create({
      projectId: data.projectId,
      rackId: data.rackId,
      accessoryTemplateId: data.accessoryTemplateId ?? null,
      name: data.name,
      kind: data.kind ?? 'shelf',
      unitStart: data.unitStart,
      heightU: data.heightU,
      mountType: data.mountType,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(row: RackAccessory, data: UpdateRackAccessoryInput & { updatedBy: string }) {
    row.merge(data)
    await row.save()
    return row
  }

  async softDelete(row: RackAccessory, deletedBy: string) {
    row.deletedAt = DateTime.now()
    row.deletedBy = deletedBy
    row.updatedBy = deletedBy
    await row.save()
  }

  async countActiveOnRack(rackId: string) {
    const row = await RackAccessory.query()
      .where('rack_id', rackId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async countSupportedDevices(accessoryId: string) {
    const row = await Device.query()
      .where('supported_by_accessory_id', accessoryId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async findDevicesOnAccessory(accessoryId: string, excludeDeviceId?: string) {
    const query = Device.query()
      .where('supported_by_accessory_id', accessoryId)
      .whereNull('deleted_at')
      .preload('deviceTemplate')
      .orderBy('shelf_slot_start', 'asc')
    if (excludeDeviceId) {
      query.whereNot('id', excludeDeviceId)
    }
    return query
  }

  /** All shelf-resting devices in a rack (for collision / occupancy). */
  async findShelfDevicesByRack(rackId: string, excludeDeviceId?: string) {
    const query = Device.query()
      .where('rack_id', rackId)
      .whereNotNull('supported_by_accessory_id')
      .whereNull('deleted_at')
      .preload('deviceTemplate')
      .preload('supportedByAccessory')
      .orderBy('shelf_slot_start', 'asc')
    if (excludeDeviceId) {
      query.whereNot('id', excludeDeviceId)
    }
    return query
  }
}
