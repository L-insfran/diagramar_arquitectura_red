import type { HttpContext } from '@adonisjs/core/http'
import Company from '#models/company'
import CompanyMembership from '#models/company_membership'
import SystemUser from '#models/system_user'
import { isAdmin } from '#services/authorization_service'
import vine from '@vinejs/vine'

const updateMembershipsValidator = vine.compile(
  vine.object({
    memberships: vine.array(
      vine.object({
        companyId: vine.string().uuid(),
        role: vine.enum(['admin', 'operator', 'viewer'] as const),
        isDefault: vine.boolean().optional(),
      })
    ),
  })
)

export default class UserMembershipsController {
  async index({ auth, params, response }: HttpContext) {
    const currentUser = auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return response.forbidden({ success: false, message: 'Only administrators can manage memberships' })
    }
    const user = await SystemUser.findOrFail(params.id)
    const memberships = await CompanyMembership.query()
      .where('system_user_id', user.id)
      .preload('company')
      .orderBy('created_at', 'asc')

    return response.ok({
      success: true,
      data: memberships.map((m) => ({
        id: m.id,
        companyId: m.companyId,
        role: m.role,
        isDefault: m.isDefault,
        company: m.company
          ? {
              id: m.company.id,
              name: m.company.name,
              domain: m.company.domain,
              isActive: m.company.isActive,
            }
          : null,
      })),
    })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const currentUser = auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return response.forbidden({ success: false, message: 'Only administrators can manage memberships' })
    }
    const user = await SystemUser.findOrFail(params.id)
    const data = await request.validateUsing(updateMembershipsValidator)

    if (!data.memberships.length) {
      return response.badRequest({
        success: false,
        message: 'El usuario debe pertenecer al menos a un cliente',
      })
    }

    const companyIds = data.memberships.map((m) => m.companyId)
    const companies = await Company.query().whereIn('id', companyIds)
    if (companies.length !== companyIds.length) {
      return response.badRequest({ success: false, message: 'Uno o más clientes no existen' })
    }

    const firstDefaultIdx = data.memberships.findIndex((m) => m.isDefault === true)
    const withSingleDefault = data.memberships.map((m, i) => ({
      ...m,
      isDefault: i === (firstDefaultIdx >= 0 ? firstDefaultIdx : 0),
    }))

    await CompanyMembership.query().where('system_user_id', user.id).delete()
    for (const m of withSingleDefault) {
      await CompanyMembership.create({
        systemUserId: user.id,
        companyId: m.companyId,
        role: m.role,
        isDefault: m.isDefault,
      })
    }

    const defaultMembership = withSingleDefault.find((m) => m.isDefault) ?? withSingleDefault[0]
    if (defaultMembership) {
      user.companyId = defaultMembership.companyId
      user.role = defaultMembership.role
      await user.save()
    }

    const memberships = await CompanyMembership.query()
      .where('system_user_id', user.id)
      .preload('company')

    return response.ok({
      success: true,
      data: memberships.map((m) => ({
        id: m.id,
        companyId: m.companyId,
        role: m.role,
        isDefault: m.isDefault,
        company: m.company
          ? {
              id: m.company.id,
              name: m.company.name,
              domain: m.company.domain,
              isActive: m.company.isActive,
            }
          : null,
      })),
    })
  }
}
