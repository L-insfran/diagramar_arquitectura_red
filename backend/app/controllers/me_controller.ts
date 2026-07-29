import type { HttpContext } from '@adonisjs/core/http'
import Company from '#models/company'
import CompanyMembership from '#models/company_membership'
import Device from '#models/device'
import Connection from '#models/connection'
import SystemUser from '#models/system_user'

export default class MeController {
  /** Companies accessible by the current user, with role and inventory counts. */
  async companies({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser

    if (user.role === 'admin') {
      const companies = await Company.query().orderBy('name', 'asc')
      const existing = await CompanyMembership.query().where('system_user_id', user.id)
      const byCompany = new Map(existing.map((m) => [m.companyId, m]))

      const payload = await Promise.all(
        companies.map(async (company) => {
          const membership = byCompany.get(company.id)
          const deviceCount = await Device.query().where('company_id', company.id).count('* as total')
          const connectionCount = await Connection.query()
            .where('company_id', company.id)
            .count('* as total')
          return {
            id: company.id,
            name: company.name,
            domain: company.domain,
            address: company.address,
            phone: company.phone,
            isActive: company.isActive,
            role: (membership?.role ?? 'admin') as 'admin' | 'operator' | 'viewer',
            isDefault: membership?.isDefault ?? company.id === user.companyId,
            deviceCount: Number(deviceCount[0].$extras.total ?? 0),
            connectionCount: Number(connectionCount[0].$extras.total ?? 0),
          }
        })
      )
      return response.ok({ success: true, data: payload })
    }

    const memberships = await CompanyMembership.query()
      .where('system_user_id', user.id)
      .preload('company')
      .orderBy('created_at', 'asc')

    if (!memberships.length && user.companyId) {
      const company = await Company.find(user.companyId)
      if (company) {
        const deviceCount = await Device.query().where('company_id', company.id).count('* as total')
        const connectionCount = await Connection.query()
          .where('company_id', company.id)
          .count('* as total')
        return response.ok({
          success: true,
          data: [
            {
              id: company.id,
              name: company.name,
              domain: company.domain,
              address: company.address,
              phone: company.phone,
              isActive: company.isActive,
              role: user.role,
              isDefault: true,
              deviceCount: Number(deviceCount[0].$extras.total ?? 0),
              connectionCount: Number(connectionCount[0].$extras.total ?? 0),
            },
          ],
        })
      }
    }

    const payload = await Promise.all(
      memberships.map(async (m) => {
        const company = m.company
        const deviceCount = await Device.query().where('company_id', company.id).count('* as total')
        const connectionCount = await Connection.query()
          .where('company_id', company.id)
          .count('* as total')
        return {
          id: company.id,
          name: company.name,
          domain: company.domain,
          address: company.address,
          phone: company.phone,
          isActive: company.isActive,
          role: m.role,
          isDefault: m.isDefault,
          deviceCount: Number(deviceCount[0].$extras.total ?? 0),
          connectionCount: Number(connectionCount[0].$extras.total ?? 0),
        }
      })
    )

    return response.ok({ success: true, data: payload })
  }
}
