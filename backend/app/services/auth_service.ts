import SystemUser from '#models/system_user'

export default class AuthService {
  async login(email: string, password: string) {
    const user = await SystemUser.verifyCredentials(email, password)

    const token = await SystemUser.accessTokens.create(user, ['*'], {
      expiresIn: '7 days',
    })

    return { user, token }
  }

  async register(data: {
    email: string
    password: string
    firstName: string
    lastName: string
    companyId: string
    role?: string
  }) {
    const user = await SystemUser.create({
      ...data,
      role: (data.role as 'admin' | 'operator' | 'viewer') ?? 'viewer',
      isActive: true,
    })

    const token = await SystemUser.accessTokens.create(user, ['*'], {
      expiresIn: '7 days',
    })

    return { user, token }
  }

  async logout(user: SystemUser) {
    const tokenId = (user as any).currentAccessToken?.identifier
    if (tokenId) {
      await SystemUser.accessTokens.delete(user, tokenId)
    }
  }
}
