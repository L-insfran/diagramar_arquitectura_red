import { mkdir, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Exception } from '@adonisjs/core/exceptions'
import type { MultipartFile } from '@adonisjs/bodyparser'
import DocumentationRepository from '#repositories/documentation_repository'
import { assertAttachableInProject } from '#services/attachable_service'
import { encryptText, decryptText } from '#services/crypto_service'
import type Attachment from '#models/attachment'
import type Secret from '#models/secret'
import type {
  AttachableType,
  AttachmentKind,
  CreateAttachmentInput,
  CreateSecretInput,
  UpdateAttachmentInput,
  UpdateSecretInput,
} from '#dtos/documentation_dto'

const ALLOWED_EXT = [
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'txt',
  'md',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'dwg',
  'dxf',
  'zip',
]

function storageRoot() {
  return join(process.cwd(), 'storage', 'attachments')
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 180) || 'file'
}

function inferKindFromFile(file: MultipartFile, kind?: AttachmentKind): AttachmentKind {
  if (kind && kind !== 'file') return kind
  const ext = (file.extname || '').toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'photo'
  return 'file'
}

function serializeAttachment(row: Attachment) {
  const json = row.serialize()
  return {
    ...json,
    hasFile: Boolean(row.storagePath),
  }
}

function serializeSecret(row: Secret) {
  const { valueCiphertext: _omit, ...rest } = row.serialize() as Record<string, unknown>
  return rest
}

export default class DocumentationService {
  private docs = new DocumentationRepository()

  async listAttachments(projectId: string, attachableType: AttachableType, attachableId: string) {
    await assertAttachableInProject(projectId, attachableType, attachableId)
    const rows = await this.docs.listAttachments(projectId, { attachableType, attachableId })
    return rows.map(serializeAttachment)
  }

  async getAttachment(id: string) {
    const row = await this.docs.findAttachmentOrFail(id)
    return serializeAttachment(row)
  }

  async getAttachmentForDownload(id: string) {
    return this.docs.findAttachmentOrFail(id)
  }

  async createAttachment(
    data: CreateAttachmentInput,
    actorId: string,
    file?: MultipartFile | null
  ) {
    await assertAttachableInProject(data.projectId, data.attachableType, data.attachableId)

    if (data.kind === 'link' && !data.url?.trim()) {
      throw new Exception('Los adjuntos tipo link requieren url', { status: 422 })
    }
    if (data.kind === 'note' && !data.description?.trim() && !file) {
      throw new Exception('Las notas requieren descripción', { status: 422 })
    }

    if (file) {
      file.sizeLimit = '20mb'
      file.allowedExtensions = ALLOWED_EXT
      file.validate()
      if (!file.isValid) {
        throw new Exception(
          file.errors.map((e) => e.message).join('; ') || 'Archivo inválido',
          { status: 422 }
        )
      }

      const kind = inferKindFromFile(file, data.kind)
      const created = await this.docs.createAttachment(
        {
          ...data,
          kind,
          storagePath: null,
          mimeType: file.headers['content-type'] || null,
          sizeBytes: file.size,
          originalFilename: file.clientName,
        },
        actorId
      )

      const safeName = sanitizeFilename(file.clientName)
      const dir = join(storageRoot(), data.projectId, created.id)
      await mkdir(dir, { recursive: true })
      await file.move(dir, { name: safeName, overwrite: true })
      if (!file.fileName) {
        await this.docs.softDeleteAttachment(created.id, actorId)
        throw new Exception('No se pudo guardar el archivo', { status: 500 })
      }

      created.storagePath = join(data.projectId, created.id, file.fileName).replace(/\\/g, '/')
      created.kind = kind
      await created.save()
      return serializeAttachment(created)
    }

    const created = await this.docs.createAttachment(data, actorId)
    return serializeAttachment(created)
  }

  async updateAttachment(id: string, data: UpdateAttachmentInput, actorId: string) {
    const updated = await this.docs.updateAttachment(id, data, actorId)
    return serializeAttachment(updated)
  }

  async deleteAttachment(id: string, actorId: string) {
    const row = await this.docs.softDeleteAttachment(id, actorId)
    if (row.storagePath) {
      try {
        await unlink(join(storageRoot(), row.storagePath))
      } catch {
        // soft-delete already done; orphan file is acceptable
      }
    }
  }

  absoluteStoragePath(relative: string) {
    return join(storageRoot(), relative)
  }

  async listSecrets(projectId: string, attachableType: AttachableType, attachableId: string) {
    await assertAttachableInProject(projectId, attachableType, attachableId)
    const rows = await this.docs.listSecrets(projectId, { attachableType, attachableId })
    return rows.map(serializeSecret)
  }

  async createSecret(data: CreateSecretInput, actorId: string) {
    await assertAttachableInProject(data.projectId, data.attachableType, data.attachableId)
    const { value, ...rest } = data
    const created = await this.docs.createSecret(
      { ...rest, valueCiphertext: encryptText(value) },
      actorId
    )
    return serializeSecret(created)
  }

  async updateSecret(id: string, data: UpdateSecretInput, actorId: string) {
    const { value, ...rest } = data
    const updated = await this.docs.updateSecret(
      id,
      {
        ...rest,
        ...(value !== undefined ? { valueCiphertext: encryptText(value) } : {}),
      },
      actorId
    )
    return serializeSecret(updated)
  }

  async deleteSecret(id: string, actorId: string) {
    await this.docs.softDeleteSecret(id, actorId)
  }

  async revealSecret(id: string) {
    const row = await this.docs.findSecretOrFail(id)
    return {
      id: row.id,
      label: row.label,
      username: row.username,
      value: decryptText(row.valueCiphertext),
    }
  }

  async getSecretSummary(id: string) {
    return this.docs.findSecretOrFail(id)
  }
}
