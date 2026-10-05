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
    const attachableType = ctx.request.input('attachableType') as AttachableType | undefined
    const attachableId = ctx.request.input('attachableId') as string | undefined
    if (!attachableType || !attachableId) {
      return ctx.response.badRequest({
        success: false,
        message: 'attachableType y attachableId son requeridos',
      })
    }

    let projectId: string | null = null
    if (attachableType === 'device_template') {
      ctx.auth.getUserOrFail()
    } else {
      const context = await requireProjectContext(ctx)
      if (!context) return
      projectId = context.projectId
    }

    try {
      const rows = await this.docs.listAttachments(projectId, attachableType, attachableId)
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

  async show(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const model = await this.docs.getAttachmentForDownload(ctx.params.id)
    if (!(await this.canReadAttachment(user, model))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const row = await this.docs.getAttachment(ctx.params.id)
    return ctx.response.ok({ success: true, data: row })
  }

  async download(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const row = await this.docs.getAttachmentForDownload(ctx.params.id)
    if (!(await this.canReadAttachment(user, row))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const { response } = ctx
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

  async update(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const existing = await this.docs.getAttachmentForDownload(ctx.params.id)
    if (!(await this.canMutateAttachment(ctx, user, existing))) return
    const data = await ctx.request.validateUsing(updateAttachmentValidator)
    const updated = await this.docs.updateAttachment(ctx.params.id, data, user.id)
    return ctx.response.ok({ success: true, data: updated })
  }

  async destroy(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const existing = await this.docs.getAttachmentForDownload(ctx.params.id)
    if (!(await this.canMutateAttachment(ctx, user, existing))) return
    await this.docs.deleteAttachment(ctx.params.id, user.id)
    return ctx.response.ok({ success: true, message: 'Attachment deleted', data: null })
  }

  private async canReadAttachment(
    user: SystemUser,
    row: { attachableType: AttachableType; projectId: string | null }
  ) {
    if (row.attachableType === 'device_template') return true
    if (!row.projectId) return false
    return canAccessProject(user, row.projectId)
  }

  /**
   * Template docs follow catalog mutation (`requireMutateProjectContext`).
   * Returns false when the response was already sent.
   */
  private async canMutateAttachment(
    ctx: HttpContext,
    user: SystemUser,
    row: { attachableType: AttachableType; projectId: string | null }
  ) {
    if (row.attachableType === 'device_template') {
      const context = await requireMutateProjectContext(ctx)
      return Boolean(context)
    }
    if (!row.projectId || !(await canMutateInProject(user, row.projectId))) {
      ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
      return false
    }
    return true
  }
}
