import SystemUser from '#models/system_user'
import CompanyMembership from '#models/company_membership'

async function serializeUserWithMemberships(user: SystemUser) {
  const memberships = await CompanyMembership.query()
    .where('system_user_id', user.id)
    .preload('company')
    .orderBy('created_at', 'asc')

  const serialized = user.serialize() as Record<string, unknown>
  delete serialized.password

  return {
    ...serialized,
    memberships: memberships.map((m) => ({
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
  }
}

export default class AuthService {
  async login(email: string, password: string) {
    const user = await SystemUser.verifyCredentials(email, password)

    const token = await SystemUser.accessTokens.create(user, ['*'], {
      expiresIn: '7 days',
    })

    return { user: await serializeUserWithMemberships(user), token }
  }

  async register(data: {
    email: string
    password: string
    firstName: string
    lastName: string
    companyId: string
    role?: string
  }) {
    const role = (data.role as 'admin' | 'operator' | 'viewer') ?? 'viewer'
    const user = await SystemUser.create({
      ...data,
      role,
      isActive: true,
    })

    await CompanyMembership.create({
      systemUserId: user.id,
      companyId: data.companyId,
      role,
      isDefault: true,
    })

    const token = await SystemUser.accessTokens.create(user, ['*'], {
      expiresIn: '7 days',
    })

    return { user: await serializeUserWithMemberships(user), token }
  }

  async me(user: SystemUser) {
    return serializeUserWithMemberships(user)
  }

  async logout(user: SystemUser) {
    const tokenId = (user as any).currentAccessToken?.identifier
    if (tokenId) {
      await SystemUser.accessTokens.delete(user, tokenId)
    }
  }
}
