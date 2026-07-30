import api from './api'
import type {
  ApiResponse,
  AttachableType,
  Attachment,
  AttachmentKind,
  ObjectSecret,
  SecretKind,
} from '../types'

export type CreateAttachmentPayload = {
  projectId: string
  attachableType: AttachableType
  attachableId: string
  kind: AttachmentKind
  title: string
  description?: string | null
  url?: string | null
  file?: File | null
}

export type CreateSecretPayload = {
  projectId: string
  attachableType: AttachableType
  attachableId: string
  kind: SecretKind
  label: string
  username?: string | null
  value: string
  notes?: string | null
}

export const documentationService = {
  async listAttachments(
    attachableType: AttachableType,
    attachableId: string
  ): Promise<Attachment[]> {
    const { data } = await api.get<ApiResponse<Attachment[]>>('/attachments', {
      params: { attachableType, attachableId },
    })
    return data.data
  },

  async createAttachment(payload: CreateAttachmentPayload): Promise<Attachment> {
    if (payload.file) {
      const form = new FormData()
      form.append('projectId', payload.projectId)
      form.append('attachableType', payload.attachableType)
      form.append('attachableId', payload.attachableId)
      form.append('kind', payload.kind)
      form.append('title', payload.title)
      if (payload.description) form.append('description', payload.description)
      if (payload.url) form.append('url', payload.url)
      form.append('file', payload.file)
      const { data } = await api.post<ApiResponse<Attachment>>('/attachments', form)
      return data.data
    }
    const { file: _f, ...json } = payload
    const { data } = await api.post<ApiResponse<Attachment>>('/attachments', json)
    return data.data
  },

  async deleteAttachment(id: string): Promise<void> {
    await api.delete(`/attachments/${id}`)
  },

  async downloadAttachment(id: string, filename?: string): Promise<void> {
    const { data } = await api.get(`/attachments/${id}/download`, {
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(data)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || 'attachment'
    a.click()
    window.URL.revokeObjectURL(url)
  },

  async listSecrets(
    attachableType: AttachableType,
    attachableId: string
  ): Promise<ObjectSecret[]> {
    const { data } = await api.get<ApiResponse<ObjectSecret[]>>('/secrets', {
      params: { attachableType, attachableId },
    })
    return data.data
  },

  async createSecret(payload: CreateSecretPayload): Promise<ObjectSecret> {
    const { data } = await api.post<ApiResponse<ObjectSecret>>('/secrets', payload)
    return data.data
  },

  async deleteSecret(id: string): Promise<void> {
    await api.delete(`/secrets/${id}`)
  },

  async revealSecret(id: string): Promise<{ id: string; label: string; username: string | null; value: string }> {
    const { data } = await api.get<
      ApiResponse<{ id: string; label: string; username: string | null; value: string }>
    >(`/secrets/${id}/reveal`)
    return data.data
  },
}
