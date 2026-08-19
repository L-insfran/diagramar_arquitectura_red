import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import ContainerService from '#services/container_service'
import type { ContainerKind } from '#dtos/container_dto'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import {
  createContainerValidator,
  updateContainerValidator,
} from '#validators/container_validator'

export default class ContainersController {
  private containerService = new ContainerService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const areaId = ctx.request.input('areaId') as string | undefined
    const siteId = ctx.request.input('siteId') as string | undefined
    const kind = ctx.request.input('kind') as ContainerKind | undefined
    const search = ctx.request.input('search') as string | undefined
    const containers = await this.containerService.getAllByProject(context.projectId, {
      areaId,
      siteId,
      kind,
      search,
    })
    return ctx.response.ok({
      success: true,
      data: containers.map((c) => ({
        ...c.serialize(),
        deviceCount: Number(c.$extras?.deviceCount ?? 0),
      })),
    })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createContainerValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El contenedor debe pertenecer al proyecto activo',
      })
    }

    try {
      const container = await this.containerService.create(data, user.id)
      return ctx.response.created({ success: true, data: container })
    } catch (error: any) {
      if (error?.status === 422) {
        return ctx.response.unprocessableEntity({ success: false, message: error.message })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const container = await this.containerService.getById(params.id)
    if (!(await canAccessProject(user, container.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: container })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.containerService.getSummary(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateContainerValidator)
    try {
      const updated = await this.containerService.update(params.id, data, user.id)
      return response.ok({ success: true, data: updated })
    } catch (error: any) {
      if (error?.status === 422 || error?.status === 409) {
        return response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const container = await this.containerService.getSummary(params.id)
    if (!(await canMutateInProject(user, container.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      await this.containerService.delete(params.id, user.id)
      return response.ok({ success: true, message: 'Contenedor eliminado', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }

  async moveDevices(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const container = await this.containerService.getSummary(ctx.params.id)
    if (!(await canMutateInProject(user, container.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const { targetContainerId, deviceIds } = ctx.request.only([
      'targetContainerId',
      'deviceIds',
    ]) as { targetContainerId: string; deviceIds?: string[] }
    if (!targetContainerId) {
      return ctx.response.unprocessableEntity({
        success: false,
        message: 'targetContainerId es requerido',
      })
    }
    try {
      await this.containerService.moveDevices(
        ctx.params.id,
        targetContainerId,
        user.id,
        deviceIds,
      )
      return ctx.response.ok({ success: true, message: 'Equipos movidos', data: null })
    } catch (error: any) {
      if (error?.status === 422) {
        return ctx.response.unprocessableEntity({ success: false, message: error.message })
      }
      throw error
    }
  }

  async occupancy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const container = await this.containerService.getSummary(params.id)
    if (!(await canAccessProject(user, container.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const occupancy = await this.containerService.getOccupancy(params.id)
    return response.ok({ success: true, data: occupancy })
  }
}
