import type { HttpContext } from '@adonisjs/core/http'
import { loginValidator, registerValidator } from '#validators/auth_validator'
import AuthService from '#services/auth_service'

export default class AuthController {
  private authService = new AuthService()

  async login({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(loginValidator)
      const result = await this.authService.login(data.email, data.password)
      return response.ok({ success: true, data: result})
    } catch (error: any) {
      console.error('Login error:', error.message || error)
      if (error.code === 'E_INVALID_CREDENTIALS') {
        return response.unauthorized({ success: false, message: 'Invalid email or password'})
      }
      return response.unauthorized({ success: false, message: 'Invalid credentials'})
    }
  }

  async register({ request, response }: HttpContext) {
    try {
      const data = await request.validateUsing(registerValidator)
      const result = await this.authService.register(data)
      return response.created({ success: true, data: result})
    } catch (error: any) {
      console.error('Register error:', error.message || error)
      return response.badRequest({ success: false, message: error.message || 'Registration failed'})
    }
  }

  async logout({ auth, response }: HttpContext) {
    try {
      const user = auth.getUserOrFail()
      await this.authService.logout(user as any)
      return response.ok({ success: true, message: 'Logged out successfully'})
    } catch {
      return response.badRequest({ success: false, message: 'Logout failed'})
    }
  }

  async me({ auth, response }: HttpContext) {
    try {
      const user = auth.getUserOrFail()
      return response.ok({ success: true, data: user})
    } catch {
      return response.unauthorized({ success: false, message: 'Not authenticated'})
    }
  }
}

