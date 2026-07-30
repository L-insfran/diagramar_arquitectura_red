import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import DocumentationService from '#services/documentation_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import type { AttachableType } from '#dtos/documentation_dto'
import {
  createAttachmentValidator,
  updateAttachmentValidator,
} from '#validators/documentation_validator'

export default class AttachmentsController {
  private docs = new DocumentationService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const attachableType = ctx.request.input('attachableType') as AttachableType | undefined
    const attachableId = ctx.request.input('attachableId') as string | undefined
    if (!attachableType || !attachableId) {
      return ctx.response.badRequest({
        success: false,
        message: 'attachableType y attachableId son requeridos',
      })
    }

    try {
      const rows = await this.docs.listAttachments(
        context.projectId,
        attachableType,
        attachableId
      )
      return ctx.response.ok({ success: true, data: rows })
    } catch (error: any) {
      if (error?.status === 422 || error?.code === 'E_ROW_NOT_FOUND') {
        return ctx.response.status(error?.status === 422 ? 422 : 404).send({
          success: false,
          message: error.message || 'Objeto no encontrado',
        })
      }
      throw error
    }
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createAttachmentValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El adjunto debe pertenecer al proyecto activo',
      })
    }

    const file = ctx.request.file('file')
    try {
      const created = await this.docs.createAttachment(data, user.id, file)
      return ctx.response.created({ success: true, data: created })
    } catch (error: any) {
      if (error?.status === 422 || error?.code === 'E_ROW_NOT_FOUND') {
        return ctx.response.status(error?.status === 422 ? 422 : 404).send({
          success: false,
          message: error.message || 'No se pudo crear el adjunto',
        })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const model = await this.docs.getAttachmentForDownload(params.id)
    if (!(await canAccessProject(user, model.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const row = await this.docs.getAttachment(params.id)
    return response.ok({ success: true, data: row })
  }

  async download({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const row = await this.docs.getAttachmentForDownload(params.id)
    if (!(await canAccessProject(user, row.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (!row.storagePath) {
      return response.notFound({ success: false, message: 'Este adjunto no tiene archivo' })
    }
    const abs = this.docs.absoluteStoragePath(row.storagePath)
    try {
      await access(abs)
    } catch {
      return response.notFound({ success: false, message: 'Archivo no encontrado en storage' })
    }
    const filename = row.originalFilename || 'attachment'
    response.header(
      'Content-Disposition',
      `attachment; filename="${filename.replace(/"/g, '')}"`
    )
    if (row.mimeType) response.header('Content-Type', row.mimeType)
    return response.stream(createReadStream(abs))
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.docs.getAttachmentForDownload(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateAttachmentValidator)
    const updated = await this.docs.updateAttachment(params.id, data, user.id)
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.docs.getAttachmentForDownload(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.docs.deleteAttachment(params.id, user.id)
    return response.ok({ success: true, message: 'Attachment deleted', data: null })
  }
}
