import type { HttpContext } from '@adonisjs/core/http'
import Port from '#models/port'
import PortType from '#models/port_type'
import { requireMutateProjectContext } from '#services/project_context_service'
import { createPortTypeValidator, updatePortTypeValidator } from '#validators/port_type_validator'

export default class PortTypesController {
  async index({ auth, response }: HttpContext) {
    auth.getUserOrFail()
    const types = await PortType.query().orderBy('name', 'asc')
    return response.ok({ success: true, data: types })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const data = await ctx.request.validateUsing(createPortTypeValidator)

    const existing = await PortType.query().where('code', data.code).first()
    if (existing) {
      return ctx.response.conflict({
        success: false,
        message: `Ya existe un tipo de puerto con el código "${data.code}"`,
      })
    }

    const portType = await PortType.create({
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      defaultSpeed: data.defaultSpeed ?? null,
      color: data.color ?? null,
      icon: data.icon ?? null,
      direction: data.direction ?? 'bidirectional',
    })
    return ctx.response.created({ success: true, data: portType })
  }

  async show({ auth, params, response }: HttpContext) {
    auth.getUserOrFail()
    const portType = await PortType.findOrFail(params.id)
    return response.ok({ success: true, data: portType })
  }

  async update(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const portType = await PortType.findOrFail(ctx.params.id)
    const data = await ctx.request.validateUsing(updatePortTypeValidator)
    portType.merge(data)
    await portType.save()
    return ctx.response.ok({ success: true, data: portType })
  }

  async destroy(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const portType = await PortType.findOrFail(ctx.params.id)

    const inUse = await Port.query().where('port_type', portType.code).first()
    if (inUse) {
      return ctx.response.conflict({
        success: false,
        message: `No se puede eliminar "${portType.name}": hay puertos que lo usan`,
      })
    }

    await portType.delete()
    return ctx.response.ok({ success: true, message: 'Port type deleted', data: null })
  }
}
