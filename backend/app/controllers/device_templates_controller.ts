import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import DeviceTemplateService from '#services/device_template_service'
import { requireMutateProjectContext } from '#services/project_context_service'
import {
  bulkUpdateTemplatePortPassthroughValidator,
  createDeviceTemplatePortValidator,
  createDeviceTemplateValidator,
  updateDeviceTemplatePortValidator,
  updateDeviceTemplateValidator,
} from '#validators/device_template_validator'

export default class DeviceTemplatesController {
  private templateService = new DeviceTemplateService()

  async index({ auth, request, response }: HttpContext) {
    auth.getUserOrFail()
    const deviceTypeId = request.input('deviceTypeId') as string | undefined
    const search = request.input('search') as string | undefined
    const templates = await this.templateService.getAll({
      deviceTypeId,
      search,
    })
    return response.ok({ success: true, data: templates })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createDeviceTemplateValidator)
    const template = await this.templateService.create(data, user.id)
    return ctx.response.created({ success: true, data: template })
  }

  async show({ auth, params, response }: HttpContext) {
    auth.getUserOrFail()
    const template = await this.templateService.getById(params.id)
    return response.ok({ success: true, data: template })
  }

  async update(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    await this.templateService.getActiveSummary(ctx.params.id)
    const data = await ctx.request.validateUsing(updateDeviceTemplateValidator)
    const updated = await this.templateService.update(ctx.params.id, data, user.id)
    return ctx.response.ok({ success: true, data: updated })
  }

  async destroy(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    await this.templateService.getActiveSummary(ctx.params.id)
    try {
      await this.templateService.delete(ctx.params.id, user.id)
      return ctx.response.ok({ success: true, message: 'Device template deleted', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return ctx.response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }

  async portsIndex({ auth, params, response }: HttpContext) {
    auth.getUserOrFail()
    await this.templateService.getActiveSummary(params.id)
    const ports = await this.templateService.listPorts(params.id)
    return response.ok({ success: true, data: ports })
  }

  async portsStore(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    await this.templateService.getActiveSummary(ctx.params.id)
    const data = await ctx.request.validateUsing(createDeviceTemplatePortValidator)
    const port = await this.templateService.createPort(ctx.params.id, data)
    return ctx.response.created({ success: true, data: port })
  }

  async portsUpdate(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    await this.templateService.getActiveSummary(ctx.params.id)
    const data = await ctx.request.validateUsing(updateDeviceTemplatePortValidator)
    const port = await this.templateService.updatePort(
      ctx.params.id,
      ctx.params.portId,
      data
    )
    return ctx.response.ok({ success: true, data: port })
  }

  async portsDestroy(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    await this.templateService.getActiveSummary(ctx.params.id)
    await this.templateService.deletePort(ctx.params.id, ctx.params.portId)
    return ctx.response.ok({ success: true, message: 'Template port deleted', data: null })
  }

  /** PUT /device-templates/:id/ports/passthrough */
  async portsBulkPassthrough(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    await this.templateService.getActiveSummary(ctx.params.id)
    const data = await ctx.request.validateUsing(bulkUpdateTemplatePortPassthroughValidator)
    const result = await this.templateService.bulkUpdatePortsPassthrough(
      ctx.params.id,
      data.isPassthrough
    )
    return ctx.response.ok({ success: true, data: result })
  }
}
