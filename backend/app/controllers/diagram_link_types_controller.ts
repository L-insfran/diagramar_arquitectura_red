import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import DiagramLinkTypeService from '#services/diagram_link_type_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import {
  createDiagramLinkTypeValidator,
  updateDiagramLinkTypeValidator,
} from '#validators/diagram_link_type_validator'

export default class DiagramLinkTypesController {
  private linkTypes = new DiagramLinkTypeService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const types = await this.linkTypes.listByProject(context.projectId)
    return ctx.response.ok({ success: true, data: types })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createDiagramLinkTypeValidator)
    try {
      const created = await this.linkTypes.create(
        { ...data, projectId: context.projectId },
        user.id
      )
      return ctx.response.created({ success: true, data: this.linkTypes.toApi(created) })
    } catch (error: any) {
      if (error?.status === 409 || error?.status === 422) {
        return ctx.response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const type = await this.linkTypes.getById(params.id)
    if (!(await canAccessProject(user, type.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: this.linkTypes.toApi(type) })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.linkTypes.getById(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateDiagramLinkTypeValidator)
    try {
      const updated = await this.linkTypes.update(params.id, data, user.id)
      return response.ok({ success: true, data: this.linkTypes.toApi(updated) })
    } catch (error: any) {
      if (error?.status === 409 || error?.status === 422) {
        return response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.linkTypes.getById(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      await this.linkTypes.delete(params.id, user.id)
      return response.ok({ success: true, message: 'Diagram link type deleted', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }
}
