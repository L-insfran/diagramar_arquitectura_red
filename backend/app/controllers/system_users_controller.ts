import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import CompanyMembership from '#models/company_membership'
import { canAccessCompany, isAdmin } from '#services/authorization_service'
import { requireCompanyContext } from '#services/company_context_service'
import {
  createSystemUserValidator,
  updateSystemUserValidator,
} from '#validators/system_user_validator'

function userJson(user: SystemUser) {
  const serialized = user.serialize() as Record<string, unknown>
  delete serialized.password
  return serialized
}

export default class SystemUsersController {
  async index(ctx: HttpContext) {
    const currentUser = ctx.auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return ctx.response.forbidden({
        success: false,
        message: 'Only administrators can manage users',
      })
    }
    const context = await requireCompanyContext(ctx)
    if (!context) return

    const users = await SystemUser.query()
      .where('company_id', context.companyId)
      .preload('company')
      .orderBy('last_name', 'asc')
    return ctx.response.ok({ success: true, data: users.map(userJson) })
  }

  async store({ auth, request, response }: HttpContext) {
    const currentUser = auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return response.forbidden({ success: false, message: 'Only administrators can manage users' })
    }
    const data = await request.validateUsing(createSystemUserValidator)

    const existing = await SystemUser.query().where('email', data.email).first()
    if (existing) {
      return response.conflict({ success: false, message: 'Ya existe un usuario con ese email' })
    }

    const user = await SystemUser.create({
      ...data,
      isActive: data.isActive ?? true,
    })

    await CompanyMembership.create({
      systemUserId: user.id,
      companyId: data.companyId,
      role: data.role,
      isDefault: true,
    })

    await user.load('company')
    return response.created({ success: true, data: userJson(user) })
  }

  async show({ auth, params, response }: HttpContext) {
    const currentUser = auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return response.forbidden({ success: false, message: 'Only administrators can manage users' })
    }
    const user = await SystemUser.query()
      .where('id', params.id)
      .preload('company')
      .firstOrFail()
    if (user.companyId && !(await canAccessCompany(currentUser, user.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: userJson(user) })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const currentUser = auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return response.forbidden({ success: false, message: 'Only administrators can manage users' })
    }
    const user = await SystemUser.findOrFail(params.id)
    const data = await request.validateUsing(updateSystemUserValidator)

    if (data.email && data.email !== user.email) {
      const existing = await SystemUser.query()
        .where('email', data.email)
        .whereNot('id', user.id)
        .first()
      if (existing) {
        return response.conflict({ success: false, message: 'Ya existe un usuario con ese email' })
      }
    }

    if (data.password) {
      user.password = data.password
    }
    const { password: _omit, ...safeData } = data
    user.merge(safeData)
    await user.save()
    await user.load('company')
    return response.ok({ success: true, data: userJson(user) })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const currentUser = auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return response.forbidden({ success: false, message: 'Only administrators can manage users' })
    }
    if (currentUser.id === params.id) {
      return response.badRequest({ success: false, message: 'No puedes eliminarte a ti mismo' })
    }
    const user = await SystemUser.findOrFail(params.id)
    await user.delete()
    return response.ok({ success: true, message: 'User deleted', data: null })
  }
}
