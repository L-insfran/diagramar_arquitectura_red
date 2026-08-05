import { createReadStream } from 'node:fs'
import { access } from 'node:fs/promises'
import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import { isAdmin } from '#services/authorization_service'
import SystemBrandingService from '#services/system_branding_service'
import { updateSystemBrandingValidator } from '#validators/system_branding_validator'

export default class SystemBrandingController {
  private branding = new SystemBrandingService()

  async show({ response }: HttpContext) {
    const data = await this.branding.getBranding()
    return response.ok({ success: true, data })
  }

  async downloadLogo({ response }: HttpContext) {
    const row = await this.branding.getRowForLogo()
    if (!row.logoStoragePath) {
      return response.notFound({ success: false, message: 'No hay logo configurado' })
    }
    const abs = this.branding.absoluteStoragePath(row.logoStoragePath)
    try {
      await access(abs)
    } catch {
      return response.notFound({ success: false, message: 'Archivo de logo no encontrado' })
    }
    const filename = row.logoOriginalFilename || 'logo'
    response.header(
      'Content-Disposition',
      `inline; filename="${filename.replace(/"/g, '')}"`
    )
    if (row.logoMimeType) response.header('Content-Type', row.logoMimeType)
    return response.stream(createReadStream(abs))
  }

  async update({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!isAdmin(user)) {
      return response.forbidden({
        success: false,
        message: 'Solo administradores globales pueden editar la marca del sistema',
      })
    }

    const data = await request.validateUsing(updateSystemBrandingValidator)
    const file = request.file('file', {
      size: '5mb',
      extnames: ['png', 'jpg', 'jpeg', 'webp', 'svg'],
    })

    if (file && !file.isValid) {
      return response.unprocessableEntity({
        success: false,
        message: file.errors?.[0]?.message || 'Archivo inválido',
      })
    }

    try {
      const updated = await this.branding.updateBranding(
        { reportTagline: data.reportTagline },
        file ?? null
      )
      return response.ok({ success: true, data: updated })
    } catch (error: any) {
      if (error?.status === 422) {
        return response.unprocessableEntity({
          success: false,
          message: error.message || 'No se pudo actualizar la marca',
        })
      }
      throw error
    }
  }

  async destroyLogo({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!isAdmin(user)) {
      return response.forbidden({
        success: false,
        message: 'Solo administradores globales pueden editar la marca del sistema',
      })
    }
    const data = await this.branding.deleteLogo()
    return response.ok({ success: true, data, message: 'Logo eliminado' })
  }
}
