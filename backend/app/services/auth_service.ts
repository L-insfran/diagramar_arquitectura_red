import SystemUser from '#models/system_user'
import ProjectMembership from '#models/project_membership'

async function serializeUserWithMemberships(user: SystemUser) {
  const memberships = await ProjectMembership.query()
    .where('system_user_id', user.id)
    .preload('project')
    .orderBy('created_at', 'asc')

  const serialized = user.serialize() as Record<string, unknown>
  delete serialized.password

  return {
    ...serialized,
    memberships: memberships.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      role: m.role,
      isDefault: m.isDefault,
      project: m.project
        ? {
            id: m.project.id,
            name: m.project.name,
            domain: m.project.domain,
            isActive: m.project.isActive,
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
    projectId: string
    role?: string
  }) {
    const role = (data.role as 'admin' | 'operator' | 'viewer') ?? 'viewer'
    const user = await SystemUser.create({
      ...data,
      role,
      isActive: true,
    })

    await ProjectMembership.create({
      systemUserId: user.id,
      projectId: data.projectId,
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
