import { Exception } from '@adonisjs/core/exceptions'
import RackAccessoryTemplateRepository from '#repositories/rack_accessory_template_repository'
import type {
  CreateRackAccessoryTemplateInput,
  UpdateRackAccessoryTemplateInput,
} from '#dtos/rack_accessory_dto'

export default class RackAccessoryTemplateService {
  private templates = new RackAccessoryTemplateRepository()

  async getAll() {
    return this.templates.findAll()
  }

  async getById(id: string) {
    return this.templates.findByIdOrFail(id)
  }

  async create(data: CreateRackAccessoryTemplateInput, actorId: string) {
    const row = await this.templates.create({
      ...data,
      kind: data.kind ?? 'shelf',
      defaultMountType: data.defaultMountType ?? 'front_only',
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.templates.findByIdOrFail(row.id)
  }

  async update(id: string, data: UpdateRackAccessoryTemplateInput, actorId: string) {
    const row = await this.templates.findByIdOrFail(id)
    await this.templates.update(row, { ...data, updatedBy: actorId })
    return this.templates.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const row = await this.templates.findByIdOrFail(id)
    await this.templates.softDelete(row, actorId)
  }
}
