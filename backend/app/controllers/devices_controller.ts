import type { HttpContext } from '@adonisjs/core/http'
import Device from '#models/device'
import SystemUser from '#models/system_user'
import DeviceService from '#services/device_service'
import { canAccessCompany, canMutate, isViewer, isNotebookType } from '#services/authorization_service'
import { createDeviceValidator, updateDeviceValidator } from '#validators/device_validator'

export default class DevicesController {
  private deviceService = new DeviceService()

  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const companyId = (request.input('companyId') as string | undefined) ?? user.companyId
    if (!canAccessCompany(user, companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const status = request.input('status') as string | undefined
    const deviceTypeId = request.input('deviceTypeId') as string | undefined
    const search = request.input('search') as string | undefined
    const devices = await this.deviceService.getAllByCompany(companyId, {
      status,
      deviceTypeId,
      search,
    })
    return response.ok({ success: true, data: devices })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const data = await request.validateUsing(createDeviceValidator)
    if (!canAccessCompany(user, data.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (isViewer(user)) {
      const notebook = await isNotebookType(data.deviceTypeId)
      if (!notebook) {
        return response.forbidden({
          success: false,
          message: 'Solo puedes crear dispositivos de tipo Notebook',
        })
      }
    }
    const device = await this.deviceService.create(data)
    await device.load('deviceType')
    return response.created({ success: true, data: device })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const device = await this.deviceService.getById(params.id)
    if (!canAccessCompany(user, device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: device })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await Device.query().where('id', params.id).preload('deviceType').firstOrFail()
    if (!canAccessCompany(user, existing.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (isViewer(user)) {
      const currentIsNotebook = await isNotebookType(existing.deviceTypeId)
      if (!currentIsNotebook) {
        return response.forbidden({
          success: false,
          message: 'Solo puedes editar dispositivos de tipo Notebook',
        })
      }
    }
    const data = await request.validateUsing(updateDeviceValidator)
    if (data.companyId && !canAccessCompany(user, data.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (isViewer(user) && data.deviceTypeId) {
      const targetIsNotebook = await isNotebookType(data.deviceTypeId)
      if (!targetIsNotebook) {
        return response.forbidden({
          success: false,
          message: 'Solo puedes asignar tipo Notebook',
        })
      }
    }
    await this.deviceService.update(params.id, data)
    const updated = await this.deviceService.getById(params.id)
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const device = await Device.findOrFail(params.id)
    if (!canAccessCompany(user, device.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.deviceService.delete(params.id)
    return response.ok({ success: true, message: 'Device deleted', data: null })
  }
}
