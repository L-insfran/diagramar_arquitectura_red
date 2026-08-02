import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import RackAccessoryService from '#services/rack_accessory_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import {
  createRackAccessoryValidator,
  updateRackAccessoryValidator,
} from '#validators/rack_accessory_validator'

export default class RackAccessoriesController {
  private service = new RackAccessoryService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const rackId = ctx.request.input('rackId') as string | undefined
    const kind = ctx.request.input('kind') as 'shelf' | undefined
    const search = ctx.request.input('search') as string | undefined
    const rows = await this.service.getAllByProject(context.projectId, { rackId, kind, search })
    return ctx.response.ok({ success: true, data: rows })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createRackAccessoryValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'La bandeja debe pertenecer al proyecto activo',
      })
    }

    try {
      const row = await this.service.create(data, user.id)
      return ctx.response.created({ success: true, data: row })
    } catch (error: any) {
      if (error?.status === 422 || error?.status === 409) {
        return ctx.response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const row = await this.service.getById(params.id)
    if (!(await canAccessProject(user, row.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: row })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.service.getSummary(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateRackAccessoryValidator)
    try {
      const updated = await this.service.update(params.id, data, user.id)
      return response.ok({ success: true, data: updated })
    } catch (error: any) {
      if (error?.status === 422 || error?.status === 409) {
        return response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const row = await this.service.getSummary(params.id)
    if (!(await canMutateInProject(user, row.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      await this.service.delete(params.id, user.id)
      return response.ok({ success: true, message: 'Accessory deleted', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }
}
