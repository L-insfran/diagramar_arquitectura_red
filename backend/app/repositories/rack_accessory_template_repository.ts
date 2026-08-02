import { DateTime } from 'luxon'
import RackAccessoryTemplate from '#models/rack_accessory_template'
import type {
  CreateRackAccessoryTemplateInput,
  UpdateRackAccessoryTemplateInput,
} from '#dtos/rack_accessory_dto'

export default class RackAccessoryTemplateRepository {
  async findAll() {
    return RackAccessoryTemplate.query()
      .whereNull('deleted_at')
      .orderBy('height_u', 'asc')
      .orderBy('name', 'asc')
  }

  async findByIdOrFail(id: string) {
    return RackAccessoryTemplate.query().where('id', id).whereNull('deleted_at').firstOrFail()
  }

  async findActive(id: string) {
    return RackAccessoryTemplate.query().where('id', id).whereNull('deleted_at').first()
  }

  async create(data: CreateRackAccessoryTemplateInput & { createdBy: string; updatedBy: string }) {
    return RackAccessoryTemplate.create({
      name: data.name,
      kind: data.kind ?? 'shelf',
      heightU: data.heightU,
      defaultMountType: data.defaultMountType ?? 'front_only',
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(
    row: RackAccessoryTemplate,
    data: UpdateRackAccessoryTemplateInput & { updatedBy: string }
  ) {
    row.merge(data)
    await row.save()
    return row
  }

  async softDelete(row: RackAccessoryTemplate, deletedBy: string) {
    row.deletedAt = DateTime.now()
    row.deletedBy = deletedBy
    row.updatedBy = deletedBy
    await row.save()
  }
}
