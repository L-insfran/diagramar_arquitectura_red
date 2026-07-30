import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import DocumentationService from '#services/documentation_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import type { AttachableType } from '#dtos/documentation_dto'
import {
  createSecretValidator,
  updateSecretValidator,
} from '#validators/documentation_validator'

export default class SecretsController {
  private docs = new DocumentationService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const attachableType = ctx.request.input('attachableType') as AttachableType | undefined
    const attachableId = ctx.request.input('attachableId') as string | undefined
    if (!attachableType || !attachableId) {
      return ctx.response.badRequest({
        success: false,
        message: 'attachableType y attachableId son requeridos',
      })
    }

    try {
      const rows = await this.docs.listSecrets(context.projectId, attachableType, attachableId)
      return ctx.response.ok({ success: true, data: rows })
    } catch (error: any) {
      if (error?.status === 422 || error?.code === 'E_ROW_NOT_FOUND') {
        return ctx.response.status(error?.status === 422 ? 422 : 404).send({
          success: false,
          message: error.message || 'Objeto no encontrado',
        })
      }
      throw error
    }
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createSecretValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El secreto debe pertenecer al proyecto activo',
      })
    }

    try {
      const created = await this.docs.createSecret(data, user.id)
      return ctx.response.created({ success: true, data: created })
    } catch (error: any) {
      if (error?.status === 422 || error?.code === 'E_ROW_NOT_FOUND') {
        return ctx.response.status(error?.status === 422 ? 422 : 404).send({
          success: false,
          message: error.message || 'No se pudo crear el secreto',
        })
      }
      throw error
    }
  }

  async reveal({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const summary = await this.docs.getSecretSummary(params.id)
    if (!(await canMutateInProject(user, summary.projectId))) {
      return response.forbidden({
        success: false,
        message: 'Solo roles con edición pueden revelar secretos',
      })
    }
    const revealed = await this.docs.revealSecret(params.id)
    return response.ok({ success: true, data: revealed })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const summary = await this.docs.getSecretSummary(params.id)
    if (!(await canMutateInProject(user, summary.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateSecretValidator)
    const updated = await this.docs.updateSecret(params.id, data, user.id)
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const summary = await this.docs.getSecretSummary(params.id)
    if (!(await canMutateInProject(user, summary.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.docs.deleteSecret(params.id, user.id)
    return response.ok({ success: true, message: 'Secret deleted', data: null })
  }
}
