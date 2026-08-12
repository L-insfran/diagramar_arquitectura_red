import type { HttpContext } from '@adonisjs/core/http'
import Device from '#models/device'
import DeviceTemplate from '#models/device_template'
import DeviceType from '#models/device_type'
import { requireMutateProjectContext } from '#services/project_context_service'
import { createDeviceTypeValidator, updateDeviceTypeValidator } from '#validators/device_type_validator'

export default class DeviceTypesController {
  async index({ auth, response }: HttpContext) {
    auth.getUserOrFail()
    const types = await DeviceType.query().orderBy('name', 'asc')
    return response.ok({ success: true, data: types})
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
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
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const deviceType = await DeviceType.findOrFail(ctx.params.id)
    const data = await ctx.request.validateUsing(updateDeviceTypeValidator)
    deviceType.merge(data)
    await deviceType.save()
    return ctx.response.ok({ success: true, data: deviceType})
  }

  async destroy(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const deviceType = await DeviceType.findOrFail(ctx.params.id)

    // Soft-deleted rows still hold the FK (ON DELETE RESTRICT) — count all references.
    const deviceRow = await Device.query()
      .where('device_type_id', deviceType.id)
      .count('* as total')
      .first()
    const templateRow = await DeviceTemplate.query()
      .where('device_type_id', deviceType.id)
      .count('* as total')
      .first()

    const devices = Number(deviceRow?.$extras?.total ?? 0)
    const templates = Number(templateRow?.$extras?.total ?? 0)
    if (devices > 0 || templates > 0) {
      const parts: string[] = []
      if (devices > 0) parts.push(`${devices} dispositivo(s)`)
      if (templates > 0) parts.push(`${templates} template(s)`)
      return ctx.response.conflict({
        success: false,
        message: `No se puede eliminar "${deviceType.name}": hay ${parts.join(' y ')} que lo usan. Reasignalos o eliminalos primero.`,
      })
    }

    await deviceType.delete()
    return ctx.response.ok({ success: true, message: 'Device type deleted', data: null})
  }
}

