import type { HttpContext } from '@adonisjs/core/http'
import CableType from '#models/cable_type'
import Connection from '#models/connection'
import { requireMutateProjectContext } from '#services/project_context_service'
import {
  createCableTypeValidator,
  updateCableTypeValidator,
} from '#validators/cable_type_validator'

export default class CableTypesController {
  async index({ auth, response }: HttpContext) {
    auth.getUserOrFail()
    const types = await CableType.query().orderBy('sort_order', 'asc').orderBy('name', 'asc')
    return response.ok({ success: true, data: types })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const data = await ctx.request.validateUsing(createCableTypeValidator)

    const existing = await CableType.query().where('code', data.code).first()
    if (existing) {
      return ctx.response.conflict({
        success: false,
        message: `Ya existe un tipo de cable con el código "${data.code}"`,
      })
    }

    const cableType = await CableType.create({
      code: data.code,
      name: data.name,
      description: data.description ?? null,
      mediumFamily: data.mediumFamily,
      defaultCategory: data.defaultCategory ?? null,
      defaultFiberType: data.defaultFiberType ?? null,
      color: data.color ?? null,
      sortOrder: data.sortOrder ?? 100,
    })
    return ctx.response.created({ success: true, data: cableType })
  }

  async show({ auth, params, response }: HttpContext) {
    auth.getUserOrFail()
    const cableType = await CableType.findOrFail(params.id)
    return response.ok({ success: true, data: cableType })
  }

  async update(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const cableType = await CableType.findOrFail(ctx.params.id)
    const data = await ctx.request.validateUsing(updateCableTypeValidator)
    cableType.merge(data)
    await cableType.save()
    return ctx.response.ok({ success: true, data: cableType })
  }

  async destroy(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const cableType = await CableType.findOrFail(ctx.params.id)

    const inUse = await Connection.query()
      .where('cable_type_id', cableType.id)
      .whereNull('deleted_at')
      .first()
    if (inUse) {
      return ctx.response.conflict({
        success: false,
        message: `No se puede eliminar "${cableType.name}": hay conexiones activas que lo usan`,
      })
    }

    await cableType.delete()
    return ctx.response.ok({ success: true, message: 'Cable type deleted', data: null })
  }
}
