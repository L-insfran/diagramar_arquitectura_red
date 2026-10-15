import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import ReleaseService from '#services/release_service'

export default class ReleaseController {
  private releases = new ReleaseService()

  async show({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const data = await this.releases.statusFor(user)
    return response.ok({ success: true, data })
  }

  async ack({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const data = await this.releases.acknowledge(user)
    return response.ok({ success: true, data })
  }
}
