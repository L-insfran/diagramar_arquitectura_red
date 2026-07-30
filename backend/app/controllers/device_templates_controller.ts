import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import DeviceTemplateService from '#services/device_template_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import {
  createDeviceTemplatePortValidator,
  createDeviceTemplateValidator,
  updateDeviceTemplatePortValidator,
  updateDeviceTemplateValidator,
} from '#validators/device_template_validator'

export default class DeviceTemplatesController {
  private templateService = new DeviceTemplateService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const deviceTypeId = ctx.request.input('deviceTypeId') as string | undefined
    const search = ctx.request.input('search') as string | undefined
    const templates = await this.templateService.getAllByProject(context.projectId, {
      deviceTypeId,
      search,
    })
    return ctx.response.ok({ success: true, data: templates })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createDeviceTemplateValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El template debe pertenecer al proyecto activo',
      })
    }

    const template = await this.templateService.create(data, user.id)
    return ctx.response.created({ success: true, data: template })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const template = await this.templateService.getById(params.id)
    if (!(await canAccessProject(user, template.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: template })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.templateService.getActiveSummary(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateDeviceTemplateValidator)
    const updated = await this.templateService.update(params.id, data, user.id)
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const template = await this.templateService.getActiveSummary(params.id)
    if (!(await canMutateInProject(user, template.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      await this.templateService.delete(params.id, user.id)
      return response.ok({ success: true, message: 'Device template deleted', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }

  async portsIndex({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const template = await this.templateService.getActiveSummary(params.id)
    if (!(await canAccessProject(user, template.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const ports = await this.templateService.listPorts(params.id)
    return response.ok({ success: true, data: ports })
  }

  async portsStore(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const template = await this.templateService.getActiveSummary(ctx.params.id)
    if (!(await canMutateInProject(user, template.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await ctx.request.validateUsing(createDeviceTemplatePortValidator)
    const port = await this.templateService.createPort(ctx.params.id, data)
    return ctx.response.created({ success: true, data: port })
  }

  async portsUpdate(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const template = await this.templateService.getActiveSummary(ctx.params.id)
    if (!(await canMutateInProject(user, template.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await ctx.request.validateUsing(updateDeviceTemplatePortValidator)
    const port = await this.templateService.updatePort(
      ctx.params.id,
      ctx.params.portId,
      data
    )
    return ctx.response.ok({ success: true, data: port })
  }

  async portsDestroy(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const template = await this.templateService.getActiveSummary(ctx.params.id)
    if (!(await canMutateInProject(user, template.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.templateService.deletePort(ctx.params.id, ctx.params.portId)
    return ctx.response.ok({ success: true, message: 'Template port deleted', data: null })
  }
}
