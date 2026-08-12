import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import BoardService from '#services/board_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import { createBoardValidator, updateBoardValidator } from '#validators/board_validator'

export default class BoardsController {
  private boardService = new BoardService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const areaId = ctx.request.input('areaId') as string | undefined
    const siteId = ctx.request.input('siteId') as string | undefined
    const search = ctx.request.input('search') as string | undefined
    const boards = await this.boardService.getAllByProject(context.projectId, {
      areaId,
      siteId,
      search,
    })
    return ctx.response.ok({ success: true, data: boards })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createBoardValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El tablero debe pertenecer al proyecto activo',
      })
    }

    try {
      const board = await this.boardService.create(data, user.id)
      return ctx.response.created({ success: true, data: board })
    } catch (error: any) {
      if (error?.status === 422) {
        return ctx.response.unprocessableEntity({ success: false, message: error.message })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const board = await this.boardService.getById(params.id)
    if (!(await canAccessProject(user, board.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: board })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.boardService.getSummary(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateBoardValidator)
    try {
      const updated = await this.boardService.update(params.id, data, user.id)
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
    const board = await this.boardService.getSummary(params.id)
    if (!(await canMutateInProject(user, board.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      await this.boardService.delete(params.id, user.id)
      return response.ok({ success: true, message: 'Board deleted', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }

  async occupancy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const board = await this.boardService.getSummary(params.id)
    if (!(await canAccessProject(user, board.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const occupancy = await this.boardService.getOccupancy(params.id)
    return response.ok({ success: true, data: occupancy })
  }
}
