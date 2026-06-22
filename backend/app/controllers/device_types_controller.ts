import type { HttpContext } from '@adonisjs/core/http'
import DeviceType from '#models/device_type'
import SystemUser from '#models/system_user'
import { createDeviceTypeValidator, updateDeviceTypeValidator } from '#validators/device_type_validator'

export default class DeviceTypesController {
  private assertAdmin(user: SystemUser) {
    return user.role === 'admin'
  }

  async index({ auth, response }: HttpContext) {
    auth.getUserOrFail()
    const types = await DeviceType.query().orderBy('name', 'asc')
    return response.ok({ success: true, data: types})
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!this.assertAdmin(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const data = await request.validateUsing(createDeviceTypeValidator)
    const deviceType = await DeviceType.create(data)
    return response.created({ success: true, data: deviceType})
  }

  async show({ auth, params, response }: HttpContext) {
    auth.getUserOrFail()
    const deviceType = await DeviceType.findOrFail(params.id)
    return response.ok({ success: true, data: deviceType})
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!this.assertAdmin(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const deviceType = await DeviceType.findOrFail(params.id)
    const data = await request.validateUsing(updateDeviceTypeValidator)
    deviceType.merge(data)
    await deviceType.save()
    return response.ok({ success: true, data: deviceType})
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!this.assertAdmin(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const deviceType = await DeviceType.findOrFail(params.id)
    await deviceType.delete()
    return response.ok({ success: true, message: 'Device type deleted', data: null})
  }
}

