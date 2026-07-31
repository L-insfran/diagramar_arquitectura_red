import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import DeviceService from '#services/device_service'
import DeviceTemplateService from '#services/device_template_service'
import PortService from '#services/port_service'
import {
  canAccessProject,
  canMutateInProject,
  isNotebookType,
  resolveRoleForProject,
} from '#services/authorization_service'
import { requireProjectContext } from '#services/project_context_service'
import { createDeviceValidator, updateDeviceValidator } from '#validators/device_validator'
import { bulkUpdatePortStatusValidator, bulkUpdatePortPassthroughValidator } from '#validators/port_validator'

export default class DevicesController {
  private deviceService = new DeviceService()
  private templateService = new DeviceTemplateService()
  private portService = new PortService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const status = ctx.request.input('status') as string | undefined
    const deviceTypeId = ctx.request.input('deviceTypeId') as string | undefined
    const deviceTemplateId = ctx.request.input('deviceTemplateId') as string | undefined
    const siteId = ctx.request.input('siteId') as string | undefined
    const areaId = ctx.request.input('areaId') as string | undefined
    const rackId = ctx.request.input('rackId') as string | undefined
    const search = ctx.request.input('search') as string | undefined
    const devices = await this.deviceService.getAllByProject(context.projectId, {
      status,
      deviceTypeId,
      deviceTemplateId,
      siteId,
      areaId,
      rackId,
      search,
    })
    return ctx.response.ok({ success: true, data: devices })
  }

  async store(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createDeviceValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }

    const template = await this.templateService.getActiveSummary(data.deviceTemplateId)

    if (context.role === 'viewer') {
      const notebook = await isNotebookType(template.deviceTypeId)
      if (!notebook) {
        return ctx.response.forbidden({
          success: false,
          message: 'Solo puedes crear dispositivos de tipo Notebook',
        })
      }
    }

    try {
      const device = await this.deviceService.create(data, user.id)
      return ctx.response.created({ success: true, data: device })
    } catch (error: any) {
      if (error?.status === 422) {
        return ctx.response.unprocessableEntity({ success: false, message: error.message })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const device = await this.deviceService.getById(params.id)
    if (!(await canAccessProject(user, device.projectId))) {
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
    const existing = await this.deviceService.getActiveSummary(params.id)
    if (!(await canAccessProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }

    const role = await resolveRoleForProject(user, existing.projectId)
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
    if (data.projectId && !(await canAccessProject(user, data.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const updated = await this.deviceService.update(params.id, data, user.id)
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const device = await this.deviceService.getActiveSummary(params.id)
    if (!(await canMutateInProject(user, device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.deviceService.delete(params.id, user.id)
    return response.ok({ success: true, message: 'Device deleted', data: null })
  }

  /** PUT /devices/:id/ports/status — set all ports of the device to up or down. */
  async bulkUpdatePortsStatus({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const device = await this.deviceService.getActiveSummary(params.id)
    if (!(await canMutateInProject(user, device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }

    const data = await request.validateUsing(bulkUpdatePortStatusValidator)
    const result = await this.portService.bulkUpdateStatus(params.id, data.status)
    return response.ok({ success: true, data: result })
  }

  /** PUT /devices/:id/ports/passthrough — set is_passthrough on every port of the device. */
  async bulkUpdatePortsPassthrough({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const device = await this.deviceService.getActiveSummary(params.id)
    if (!(await canMutateInProject(user, device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }

    const data = await request.validateUsing(bulkUpdatePortPassthroughValidator)
    const result = await this.portService.bulkUpdatePassthrough(params.id, data.isPassthrough)
    return response.ok({ success: true, data: result })
  }
}
