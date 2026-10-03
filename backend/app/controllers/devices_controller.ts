import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import DeviceService, { DiagramRelocationRequiredError } from '#services/device_service'
import DeviceTemplateService from '#services/device_template_service'
import PortService from '#services/port_service'
import {
  canAccessProject,
  canMutateInProject,
  isNotebookType,
  resolveRoleForProject,
} from '#services/authorization_service'
import { requireProjectContext, requireMutateProjectContext } from '#services/project_context_service'
import {
  createDeviceValidator,
  updateDeviceValidator,
  assignContainerValidator,
} from '#validators/device_validator'
import { bulkUpdatePortStatusValidator, bulkUpdatePortPassthroughValidator } from '#validators/port_validator'

function parsePositiveInt(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined
  const value = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(value) || value < 1) return undefined
  return Math.floor(value)
}

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
    const containerId = ctx.request.input('containerId') as string | undefined
    const search = ctx.request.input('search') as string | undefined
    const summaryRaw = ctx.request.input('summary')
    const summary = summaryRaw === '1' || summaryRaw === 'true' || summaryRaw === true
    const page = parsePositiveInt(ctx.request.input('page'))
    const perPage = parsePositiveInt(ctx.request.input('perPage'))
    const filters = {
      status,
      deviceTypeId,
      deviceTemplateId,
      siteId,
      areaId,
      containerId,
      search,
      summary,
      perPage,
    }
    if (page) {
      const data = await this.deviceService.getPageByProject(context.projectId, { ...filters, page })
      return ctx.response.ok({ success: true, data })
    }
    const devices = await this.deviceService.getAllByProject(context.projectId, filters)
    return ctx.response.ok({ success: true, data: devices })
  }

  async filterOptions(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const data = await this.deviceService.listFilterOptions(context.projectId)
    return ctx.response.ok({ success: true, data })
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

  async relocationImpact({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const device = await this.deviceService.getActiveSummary(params.id)
    if (!(await canAccessProject(user, device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }

    const areaIdRaw = request.input('areaId') as string | undefined
    const areaId = areaIdRaw === '' || areaIdRaw === undefined ? null : areaIdRaw
    const containerIdRaw = request.input('containerId') as string | undefined
    const containerId =
      containerIdRaw === '' || containerIdRaw === undefined ? null : containerIdRaw

    try {
      const impact = await this.deviceService.getRelocationImpact(params.id, areaId, containerId)
      return response.ok({ success: true, data: impact })
    } catch (error: any) {
      if (error?.status === 422) {
        return response.unprocessableEntity({ success: false, message: error.message })
      }
      throw error
    }
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
    try {
      const updated = await this.deviceService.update(params.id, data, user.id)
      return response.ok({ success: true, data: updated })
    } catch (error: any) {
      if (error instanceof DiagramRelocationRequiredError) {
        return response.conflict({
          success: false,
          code: DiagramRelocationRequiredError.code,
          impact: error.impact,
          message: error.message,
        })
      }
      if (error?.status === 422) {
        return response.unprocessableEntity({ success: false, message: error.message })
      }
      throw error
    }
  }

  /** POST /devices/:id/assign-container — placement sin U/celda (diagrama). */
  async assignContainer(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const device = await this.deviceService.getActiveSummary(ctx.params.id)
    if (device.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El dispositivo debe pertenecer al proyecto activo',
      })
    }

    const data = await ctx.request.validateUsing(assignContainerValidator)
    try {
      const updated = await this.deviceService.assignToContainer(
        ctx.params.id,
        { containerId: data.containerId, areaId: data.areaId },
        user.id,
      )
      return ctx.response.ok({ success: true, data: updated })
    } catch (error: any) {
      if (error?.status === 422) {
        return ctx.response.unprocessableEntity({ success: false, message: error.message })
      }
      throw error
    }
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
