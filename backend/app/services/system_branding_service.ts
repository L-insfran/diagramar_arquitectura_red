import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Exception } from '@adonisjs/core/exceptions'
import type { MultipartFile } from '@adonisjs/bodyparser'
import SystemSettingRepository from '#repositories/system_setting_repository'
import type SystemSetting from '#models/system_setting'
import type {
  SystemBrandingDto,
  UpdateSystemBrandingInput,
} from '#dtos/system_branding_dto'

const ALLOWED_EXT = ['png', 'jpg', 'jpeg', 'webp', 'svg']
const MAX_LOGO_BYTES = 5 * 1024 * 1024

function storageRoot() {
  return join(process.cwd(), 'storage', 'system')
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'logo'
}

function serialize(row: SystemSetting): SystemBrandingDto {
  return {
    reportTagline: row.reportTagline,
    hasLogo: Boolean(row.logoStoragePath),
    logoMimeType: row.logoMimeType,
    logoOriginalFilename: row.logoOriginalFilename,
    logoSizeBytes: row.logoSizeBytes != null ? Number(row.logoSizeBytes) : null,
    updatedAt: row.updatedAt?.toISO() ?? null,
  }
}

export default class SystemBrandingService {
  private repo = new SystemSettingRepository()

  async getOrCreate(): Promise<SystemSetting> {
    const existing = await this.repo.findSingleton()
    if (existing) return existing
    return this.repo.createEmpty()
  }

  async getBranding(): Promise<SystemBrandingDto> {
    const row = await this.getOrCreate()
    return serialize(row)
  }

  async getRowForLogo(): Promise<SystemSetting> {
    return this.getOrCreate()
  }

  absoluteStoragePath(relative: string) {
    return join(storageRoot(), relative)
  }

  async updateBranding(
    data: UpdateSystemBrandingInput,
    file?: MultipartFile | null
  ): Promise<SystemBrandingDto> {
    const row = await this.getOrCreate()

    if (data.reportTagline !== undefined) {
      const trimmed = data.reportTagline?.trim() || null
      row.reportTagline = trimmed
    }

    if (file) {
      await this.replaceLogo(row, file)
    }

    await this.repo.save(row)
    return serialize(row)
  }

  async deleteLogo(): Promise<SystemBrandingDto> {
    const row = await this.getOrCreate()
    if (row.logoStoragePath) {
      await this.safeUnlink(this.absoluteStoragePath(row.logoStoragePath))
    }
    row.logoStoragePath = null
    row.logoMimeType = null
    row.logoOriginalFilename = null
    row.logoSizeBytes = null
    await this.repo.save(row)
    return serialize(row)
  }

  private async replaceLogo(row: SystemSetting, file: MultipartFile) {
    const ext = (file.extname || '').toLowerCase().replace(/^\./, '')
    if (!ALLOWED_EXT.includes(ext)) {
      throw new Exception(
        `Formato no permitido. Usa: ${ALLOWED_EXT.join(', ')}`,
        { status: 422 }
      )
    }
    if (file.size && file.size > MAX_LOGO_BYTES) {
      throw new Exception('El logo no puede superar 5 MB', { status: 422 })
    }
    if (!file.isValid) {
      throw new Exception(file.errors?.[0]?.message || 'Archivo inválido', { status: 422 })
    }

    const dir = storageRoot()
    await mkdir(dir, { recursive: true })

    const safeName = `logo.${ext}`
    const previousPath = row.logoStoragePath

    await file.move(dir, { name: safeName, overwrite: true })
    if (!file.fileName) {
      throw new Exception('No se pudo guardar el logo', { status: 500 })
    }

    if (previousPath && previousPath !== safeName) {
      await this.safeUnlink(this.absoluteStoragePath(previousPath))
    }

    row.logoStoragePath = safeName
    row.logoMimeType = file.headers['content-type'] || this.mimeFromExt(ext)
    row.logoOriginalFilename = sanitizeFilename(file.clientName || safeName)
    row.logoSizeBytes = file.size ?? null
  }

  private mimeFromExt(ext: string): string {
    switch (ext) {
      case 'png':
        return 'image/png'
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'webp':
        return 'image/webp'
      case 'svg':
        return 'image/svg+xml'
      default:
        return 'application/octet-stream'
    }
  }

  private async safeUnlink(abs: string) {
    try {
      await unlink(abs)
    } catch {
      // ignore missing file
    }
  }
}
