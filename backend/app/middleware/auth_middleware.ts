import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

export default class AuthMiddleware {
  async handle({ auth, response }: HttpContext, next: NextFn) {
    try {
      await auth.authenticate()
      return next()
    } catch {
      return response.unauthorized({ success: false, message: 'Authentication required' })
    }
  }
}
