import type { HttpContext } from '@adonisjs/core/http'
import hash from '@adonisjs/core/services/hash'
import DeviceCredential from '#models/device_credential'
import Device from '#models/device'
import SystemUser from '#models/system_user'
import {
  createDeviceCredentialValidator,
  updateDeviceCredentialValidator,
} from '#validators/device_credential_validator'

function canAccessCompany(user: SystemUser, companyId: string) {
  return user.role === 'admin' || user.companyId === companyId
}

function credentialJson(credential: DeviceCredential) {
  const serialized = credential.serialize() as Record<string, unknown>
  const { password: _p, ...safe } = serialized
  return safe
}

export default class DeviceCredentialsController {
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
    const rows = await DeviceCredential.query().where('device_id', deviceId).orderBy('credential_type', 'asc')
    return response.ok({ success: true, data: rows.map((c) => credentialJson(c)) })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const data = await request.validateUsing(createDeviceCredentialValidator)
    const device = await Device.findOrFail(data.deviceId)
    if (!canAccessCompany(user, device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const { password, ...rest } = data
    const credential = await DeviceCredential.create({
      ...rest,
      password: await hash.make(password),
    })
    return response.created({ success: true, data: credentialJson(credential) })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const credential = await DeviceCredential.query().where('id', params.id).preload('device').firstOrFail()
    if (!canAccessCompany(user, credential.device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: credentialJson(credential) })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const credential = await DeviceCredential.query().where('id', params.id).preload('device').firstOrFail()
    if (!canAccessCompany(user, credential.device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateDeviceCredentialValidator)
    if (data.password) {
      credential.password = await hash.make(data.password)
    }
    const { password: _omit, ...rest } = data
    credential.merge(rest)
    await credential.save()
    return response.ok({ success: true, data: credentialJson(credential) })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const credential = await DeviceCredential.query().where('id', params.id).preload('device').firstOrFail()
    if (!canAccessCompany(user, credential.device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await credential.delete()
    return response.ok({ success: true, message: 'Credential deleted', data: null })
  }
}
