import type { HttpContext } from '@adonisjs/core/http'
import DeviceType from '#models/device_type'
import { requireMutateCompanyContext } from '#services/company_context_service'
import { createDeviceTypeValidator, updateDeviceTypeValidator } from '#validators/device_type_validator'

export default class DeviceTypesController {
  async index({ auth, response }: HttpContext) {
    auth.getUserOrFail()
    const types = await DeviceType.query().orderBy('name', 'asc')
    return response.ok({ success: true, data: types})
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateCompanyContext(ctx)
    if (!context) return
    const data = await ctx.request.validateUsing(createDeviceTypeValidator)
    const deviceType = await DeviceType.create(data)
    return ctx.response.created({ success: true, data: deviceType})
  }

  async show({ auth, params, response }: HttpContext) {
    auth.getUserOrFail()
    const deviceType = await DeviceType.findOrFail(params.id)
    return response.ok({ success: true, data: deviceType})
  }

  async update(ctx: HttpContext) {
    const context = await requireMutateCompanyContext(ctx)
    if (!context) return
    const deviceType = await DeviceType.findOrFail(ctx.params.id)
    const data = await ctx.request.validateUsing(updateDeviceTypeValidator)
    deviceType.merge(data)
    await deviceType.save()
    return ctx.response.ok({ success: true, data: deviceType})
  }

  async destroy(ctx: HttpContext) {
    const context = await requireMutateCompanyContext(ctx)
    if (!context) return
    const deviceType = await DeviceType.findOrFail(ctx.params.id)
    await deviceType.delete()
    return ctx.response.ok({ success: true, message: 'Device type deleted', data: null})
  }
}

