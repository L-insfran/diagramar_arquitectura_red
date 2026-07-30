import { DateTime } from 'luxon'
import Rack from '#models/rack'
import Device from '#models/device'
import Area from '#models/area'
import type { CreateRackInput, RackFilters, UpdateRackInput } from '#dtos/rack_dto'

export default class RackRepository {
  async findAllByProject(projectId: string, filters?: RackFilters) {
    const query = Rack.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('area', (q) => q.preload('site'))
      .orderBy('name', 'asc')

    if (filters?.areaId) {
      query.where('area_id', filters.areaId)
    }
    if (filters?.siteId) {
      query.whereHas('area', (aq) => {
        aq.where('site_id', filters.siteId!)
      })
    }
    if (filters?.search) {
      query.where((q) => {
        q.whereILike('name', `%${filters.search}%`)
          .orWhereILike('code', `%${filters.search}%`)
          .orWhereILike('manufacturer', `%${filters.search}%`)
          .orWhereILike('model', `%${filters.search}%`)
      })
    }

    return query
  }

  async findByIdOrFail(id: string) {
    return Rack.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('area', (q) => q.preload('site'))
      .firstOrFail()
  }

  async findSummaryOrFail(id: string) {
    return Rack.query().where('id', id).whereNull('deleted_at').preload('area').firstOrFail()
  }

  async findActiveInProject(id: string, projectId: string) {
    return Rack.query()
      .where('id', id)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('area')
      .first()
  }

  async create(data: CreateRackInput & { createdBy: string; updatedBy: string }) {
    return Rack.create({
      projectId: data.projectId,
      areaId: data.areaId,
      name: data.name,
      code: data.code ?? null,
      heightU: data.heightU ?? 42,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(rack: Rack, data: UpdateRackInput & { updatedBy: string }) {
    rack.merge(data)
    await rack.save()
    return rack
  }

  async softDelete(rack: Rack, deletedBy: string) {
    rack.deletedAt = DateTime.now()
    rack.deletedBy = deletedBy
    rack.updatedBy = deletedBy
    await rack.save()
  }

  async countActiveDevices(rackId: string) {
    const row = await Device.query()
      .where('rack_id', rackId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async findMountedDevices(rackId: string) {
    return Device.query()
      .where('rack_id', rackId)
      .whereNull('deleted_at')
      .whereNotNull('rack_unit_start')
      .preload('deviceTemplate')
      .orderBy('rack_unit_start', 'asc')
  }

  async findAreaWithSite(areaId: string) {
    return Area.query().where('id', areaId).whereNull('deleted_at').preload('site').first()
  }
}
