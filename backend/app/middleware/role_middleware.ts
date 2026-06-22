import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class RoleMiddleware {
  async handle({ auth, response }: HttpContext, next: NextFn, options: { roles: string[] }) {
    const user = auth.getUserOrFail() as any
    if (!options.roles.includes(user.role)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return next()
  }
}
