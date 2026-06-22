import type { HttpContext } from '@adonisjs/core/http'
import Port from '#models/port'
import Device from '#models/device'
import SystemUser from '#models/system_user'
import { canAccessCompany, canMutate } from '#services/authorization_service'
import { createPortValidator, updatePortValidator } from '#validators/port_validator'

export default class PortsController {
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const deviceId = request.input('device_id') as string | undefined
    if (!deviceId) {
      return response.badRequest({ success: false, message: 'device_id query parameter is required' })
    }
    const device = await Device.findOrFail(deviceId)
    if (!canAccessCompany(user, device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const ports = await Port.query().where('device_id', deviceId).orderBy('port_number', 'asc')
    return response.ok({ success: true, data: ports })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(createPortValidator)
    const device = await Device.findOrFail(data.deviceId)
    if (!canAccessCompany(user, device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const port = await Port.create(data)
    return response.created({ success: true, data: port })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const port = await Port.query()
      .where('id', params.id)
      .preload('device')
      .preload('vlans')
      .firstOrFail()
    if (!canAccessCompany(user, port.device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: port })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const port = await Port.query().where('id', params.id).preload('device').firstOrFail()
    if (!canAccessCompany(user, port.device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updatePortValidator)
    if (data.deviceId) {
      const targetDevice = await Device.findOrFail(data.deviceId)
      if (!canAccessCompany(user, targetDevice.companyId)) {
        return response.forbidden({ success: false, message: 'Insufficient permissions' })
      }
    }
    port.merge(data)
    await port.save()
    const updated = await Port.query()
      .where('id', port.id)
      .preload('device')
      .preload('vlans')
      .firstOrFail()
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const port = await Port.query().where('id', params.id).preload('device').firstOrFail()
    if (!canAccessCompany(user, port.device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await port.delete()
    return response.ok({ success: true, message: 'Port deleted', data: null })
  }
}
