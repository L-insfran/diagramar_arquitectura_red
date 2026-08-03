import type { HttpContext } from '@adonisjs/core/http'
import Port from '#models/port'
import PortType from '#models/port_type'
import Device from '#models/device'
import Vlan from '#models/vlan'
import SystemUser from '#models/system_user'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import PortService from '#services/port_service'
import { createPortValidator, updatePortValidator } from '#validators/port_validator'

type VlanAssignment = { vlanId: string; isTagged?: boolean }

export default class PortsController {
  private portService = new PortService()

  private async assertPortTypeExists(code: string | undefined) {
    if (!code) return
    const exists = await PortType.query().where('code', code).first()
    if (!exists) {
      throw new Error(`Tipo de puerto desconocido: "${code}"`)
    }
  }

  private async syncPortVlans(port: Port, projectId: string, assignments: VlanAssignment[]) {
    const uniqueIds = [...new Set(assignments.map((a) => a.vlanId))]
    if (uniqueIds.length) {
      const vlans = await Vlan.query().where('project_id', projectId).whereIn('id', uniqueIds)
      if (vlans.length !== uniqueIds.length) {
        throw new Error('Una o más VLANs no pertenecen a la empresa del dispositivo')
      }
    }

    const syncPayload: Record<string, { is_tagged: boolean }> = {}
    for (const assignment of assignments) {
      const multi = assignments.length > 1
      syncPayload[assignment.vlanId] = {
        is_tagged: assignment.isTagged ?? multi,
      }
    }
    await port.related('vlans').sync(syncPayload)
  }

  private serializePort(port: Port) {
    const json = port.serialize() as Record<string, unknown>
    if (port.vlans) {
      json.vlans = port.vlans.map((vlan) => ({
        ...vlan.serialize(),
        isTagged: !!vlan.$extras?.pivot?.is_tagged,
      }))
    }
    return json
  }

  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const deviceId = request.input('device_id') as string | undefined
    if (!deviceId) {
      return response.badRequest({ success: false, message: 'device_id query parameter is required' })
    }
    const device = await Device.query().where('id', deviceId).whereNull('deleted_at').firstOrFail()
    if (!(await canAccessProject(user, device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const ports = await Port.query()
      .where('device_id', deviceId)
      .preload('vlans')
      .orderBy('port_number', 'asc')
    return response.ok({
      success: true,
      data: ports.map((port) => this.serializePort(port)),
    })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const data = await request.validateUsing(createPortValidator)
    const device = await Device.query().where('id', data.deviceId).whereNull('deleted_at').firstOrFail()
    if (!(await canMutateInProject(user, device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }

    const { vlanAssignments, ...portData } = data
    try {
      await this.assertPortTypeExists(portData.portType)
    } catch (err) {
      return response.badRequest({
        success: false,
        message: err instanceof Error ? err.message : 'Tipo de puerto inválido',
      })
    }

    const isPassthrough = portData.isPassthrough ?? false
    const chassisFace = isPassthrough ? 'front' : (portData.chassisFace ?? 'front')
    const status = this.portService.resolveStatusForCreate(isPassthrough, portData.status)
    const port = await Port.create({ ...portData, isPassthrough, chassisFace, status })

    if (vlanAssignments) {
      try {
        await this.syncPortVlans(port, device.projectId, vlanAssignments)
      } catch (err) {
        await port.delete()
        return response.badRequest({
          success: false,
          message: err instanceof Error ? err.message : 'No se pudieron asignar las VLANs',
        })
      }
    }

    const created = await Port.query().where('id', port.id).preload('vlans').firstOrFail()
    return response.created({ success: true, data: this.serializePort(created) })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const port = await Port.query()
      .where('id', params.id)
      .preload('device')
      .preload('vlans')
      .firstOrFail()
    if (!(await canAccessProject(user, port.device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: this.serializePort(port) })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const port = await Port.query().where('id', params.id).preload('device').firstOrFail()
    if (!(await canMutateInProject(user, port.device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updatePortValidator)
    if (data.deviceId) {
      const targetDevice = await Device.query()
        .where('id', data.deviceId)
        .whereNull('deleted_at')
        .firstOrFail()
      if (!(await canMutateInProject(user, targetDevice.projectId))) {
        return response.forbidden({ success: false, message: 'Insufficient permissions' })
      }
    }

    const { vlanAssignments, ...portData } = data
    try {
      await this.assertPortTypeExists(portData.portType)
    } catch (err) {
      return response.badRequest({
        success: false,
        message: err instanceof Error ? err.message : 'Tipo de puerto inválido',
      })
    }

    const resultingPassthrough =
      portData.isPassthrough !== undefined ? portData.isPassthrough : port.isPassthrough
    try {
      this.portService.assertPassthroughStatusAllowed(resultingPassthrough, portData.status)
    } catch (err: unknown) {
      const status = err && typeof err === 'object' && 'status' in err ? Number(err.status) : 0
      if (status === 422) {
        return response.unprocessableEntity({
          success: false,
          message: err instanceof Error ? err.message : 'Un puerto puente siempre está Up',
        })
      }
      throw err
    }

    if (resultingPassthrough) {
      portData.status = 'up'
    }

    port.merge(portData)
    await port.save()

    if (vlanAssignments !== undefined) {
      try {
        await this.syncPortVlans(port, port.device.projectId, vlanAssignments)
      } catch (err) {
        return response.badRequest({
          success: false,
          message: err instanceof Error ? err.message : 'No se pudieron asignar las VLANs',
        })
      }
    }

    const updated = await Port.query()
      .where('id', port.id)
      .preload('device')
      .preload('vlans')
      .firstOrFail()
    return response.ok({ success: true, data: this.serializePort(updated) })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const port = await Port.query().where('id', params.id).preload('device').firstOrFail()
    if (!(await canMutateInProject(user, port.device.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await port.delete()
    return response.ok({ success: true, message: 'Port deleted', data: null })
  }
}
