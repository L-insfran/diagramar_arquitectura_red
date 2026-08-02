import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import RackAccessoryTemplateService from '#services/rack_accessory_template_service'
import { canMutate } from '#services/authorization_service'
import {
  createRackAccessoryTemplateValidator,
  updateRackAccessoryTemplateValidator,
} from '#validators/rack_accessory_validator'

export default class RackAccessoryTemplatesController {
  private service = new RackAccessoryTemplateService()

  async index({ response }: HttpContext) {
    const rows = await this.service.getAll()
    return response.ok({ success: true, data: rows })
  }

  async show({ params, response }: HttpContext) {
    const row = await this.service.getById(params.id)
    return response.ok({ success: true, data: row })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(createRackAccessoryTemplateValidator)
    const row = await this.service.create(data, user.id)
    return response.created({ success: true, data: row })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateRackAccessoryTemplateValidator)
    const row = await this.service.update(params.id, data, user.id)
    return response.ok({ success: true, data: row })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.service.delete(params.id, user.id)
    return response.ok({ success: true, message: 'Accessory template deleted', data: null })
  }
}
