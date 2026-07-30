import { DateTime } from 'luxon'
import Attachment from '#models/attachment'
import Secret from '#models/secret'
import type {
  AttachmentFilters,
  CreateAttachmentInput,
  CreateSecretInput,
  UpdateAttachmentInput,
  UpdateSecretInput,
} from '#dtos/documentation_dto'

export default class DocumentationRepository {
  listAttachments(projectId: string, filters: AttachmentFilters) {
    return Attachment.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .where('attachable_type', filters.attachableType)
      .where('attachable_id', filters.attachableId)
      .orderBy('created_at', 'desc')
  }

  findAttachmentOrFail(id: string) {
    return Attachment.query().where('id', id).whereNull('deleted_at').firstOrFail()
  }

  async createAttachment(
    data: CreateAttachmentInput & {
      storagePath?: string | null
      mimeType?: string | null
      sizeBytes?: number | null
      originalFilename?: string | null
    },
    actorId: string
  ) {
    return Attachment.create({
      projectId: data.projectId,
      attachableType: data.attachableType,
      attachableId: data.attachableId,
      kind: data.kind,
      title: data.title,
      description: data.description ?? null,
      url: data.url ?? null,
      storagePath: data.storagePath ?? null,
      mimeType: data.mimeType ?? null,
      sizeBytes: data.sizeBytes ?? null,
      originalFilename: data.originalFilename ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    })
  }

  async updateAttachment(id: string, data: UpdateAttachmentInput, actorId: string) {
    const row = await this.findAttachmentOrFail(id)
    row.merge({
      ...data,
      updatedBy: actorId,
    })
    await row.save()
    return row
  }

  async softDeleteAttachment(id: string, actorId: string) {
    const row = await this.findAttachmentOrFail(id)
    row.deletedAt = DateTime.now()
    row.deletedBy = actorId
    row.updatedBy = actorId
    await row.save()
    return row
  }

  listSecrets(projectId: string, filters: AttachmentFilters) {
    return Secret.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .where('attachable_type', filters.attachableType)
      .where('attachable_id', filters.attachableId)
      .orderBy('kind', 'asc')
      .orderBy('label', 'asc')
  }

  findSecretOrFail(id: string) {
    return Secret.query().where('id', id).whereNull('deleted_at').firstOrFail()
  }

  async createSecret(
    data: Omit<CreateSecretInput, 'value'> & { valueCiphertext: string },
    actorId: string
  ) {
    return Secret.create({
      projectId: data.projectId,
      attachableType: data.attachableType,
      attachableId: data.attachableId,
      kind: data.kind,
      label: data.label,
      username: data.username ?? null,
      valueCiphertext: data.valueCiphertext,
      notes: data.notes ?? null,
      createdBy: actorId,
      updatedBy: actorId,
    })
  }

  async updateSecret(
    id: string,
    data: Omit<UpdateSecretInput, 'value'> & { valueCiphertext?: string },
    actorId: string
  ) {
    const row = await this.findSecretOrFail(id)
    const { valueCiphertext, ...rest } = data
    row.merge({
      ...rest,
      ...(valueCiphertext !== undefined ? { valueCiphertext } : {}),
      updatedBy: actorId,
    })
    await row.save()
    return row
  }

  async softDeleteSecret(id: string, actorId: string) {
    const row = await this.findSecretOrFail(id)
    row.deletedAt = DateTime.now()
    row.deletedBy = actorId
    row.updatedBy = actorId
    await row.save()
    return row
  }
}
