import type { HttpContext } from '@adonisjs/core/http'
import Device from '#models/device'
import SystemUser from '#models/system_user'
import DeviceService from '#services/device_service'
import {
  canAccessCompany,
  canMutateInCompany,
  isNotebookType,
  resolveRoleForCompany,
} from '#services/authorization_service'
import { requireCompanyContext } from '#services/company_context_service'
import { createDeviceValidator, updateDeviceValidator } from '#validators/device_validator'

export default class DevicesController {
  private deviceService = new DeviceService()

  async index(ctx: HttpContext) {
    const context = await requireCompanyContext(ctx)
    if (!context) return

    const status = ctx.request.input('status') as string | undefined
    const deviceTypeId = ctx.request.input('deviceTypeId') as string | undefined
    const search = ctx.request.input('search') as string | undefined
    const devices = await this.deviceService.getAllByCompany(context.companyId, {
      status,
      deviceTypeId,
      search,
    })
    return ctx.response.ok({ success: true, data: devices })
  }

  async store(ctx: HttpContext) {
    const context = await requireCompanyContext(ctx)
    if (!context) return

    const data = await ctx.request.validateUsing(createDeviceValidator)
    if (!(await canAccessCompany(ctx.auth.getUserOrFail() as SystemUser, data.companyId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (context.role === 'viewer') {
      const notebook = await isNotebookType(data.deviceTypeId)
      if (!notebook) {
        return ctx.response.forbidden({
          success: false,
          message: 'Solo puedes crear dispositivos de tipo Notebook',
        })
      }
    }
    const device = await this.deviceService.create(data)
    await device.load('deviceType')
    return ctx.response.created({ success: true, data: device })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const device = await this.deviceService.getById(params.id)
    if (!(await canAccessCompany(user, device.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = device.serialize() as Record<string, unknown>
    if (device.ports) {
      data.ports = device.ports.map((port) => {
        const portJson = port.serialize() as Record<string, unknown>
        if (port.vlans) {
          portJson.vlans = port.vlans.map((vlan) => ({
            ...vlan.serialize(),
            isTagged: !!vlan.$extras?.pivot?.is_tagged,
          }))
        }
        return portJson
      })
    }
    return response.ok({ success: true, data })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await Device.query().where('id', params.id).preload('deviceType').firstOrFail()
    if (!(await canAccessCompany(user, existing.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }

    const role = await resolveRoleForCompany(user, existing.companyId)
    const isViewerRole = role === 'viewer'

    if (isViewerRole) {
      const currentIsNotebook = await isNotebookType(existing.deviceTypeId)
      if (!currentIsNotebook) {
        return response.forbidden({
          success: false,
          message: 'Solo puedes editar dispositivos de tipo Notebook',
        })
      }
    }
    const data = await request.validateUsing(updateDeviceValidator)
    if (data.companyId && !(await canAccessCompany(user, data.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (isViewerRole && data.deviceTypeId) {
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
    const device = await Device.findOrFail(params.id)
    if (!(await canMutateInCompany(user, device.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.deviceService.delete(params.id)
    return response.ok({ success: true, message: 'Device deleted', data: null })
  }
}
