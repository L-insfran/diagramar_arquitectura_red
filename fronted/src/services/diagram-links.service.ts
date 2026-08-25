import api from './api'
import type { ApiResponse, DiagramLink } from '../types'

export type CreateDiagramLinkPayload = {
  projectId: string
  sourceDeviceId: string
  targetDeviceId: string
  sourcePortId?: string | null
  targetPortId?: string | null
  sourcePortLabel: string
  targetPortLabel: string
  description?: string | null
  cableTypeId?: string | null
}

export type UpdateDiagramLinkPayload = {
  sourceDeviceId?: string
  targetDeviceId?: string
  sourcePortId?: string | null
  targetPortId?: string | null
  sourcePortLabel?: string
  targetPortLabel?: string
  description?: string | null
  cableTypeId?: string | null
}

export const diagramLinksService = {
  async getAll(): Promise<DiagramLink[]> {
    const { data } = await api.get<ApiResponse<DiagramLink[]>>('/diagram-links')
    return data.data
  },

  async getById(id: string): Promise<DiagramLink> {
    const { data } = await api.get<ApiResponse<DiagramLink>>(`/diagram-links/${id}`)
    return data.data
  },

  async create(payload: CreateDiagramLinkPayload): Promise<DiagramLink> {
    const { data } = await api.post<ApiResponse<DiagramLink>>('/diagram-links', payload)
    return data.data
  },

  async update(id: string, payload: UpdateDiagramLinkPayload): Promise<DiagramLink> {
    const { data } = await api.put<ApiResponse<DiagramLink>>(`/diagram-links/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/diagram-links/${id}`)
  },

  async bulkDeleteByDevices(
    deviceIds: string[],
  ): Promise<{ deletedCount: number; codes: number[] }> {
    const { data } = await api.post<
      ApiResponse<{ deletedCount: number; codes: number[] }>
    >('/diagram-links/bulk-delete', { deviceIds })
    return data.data
  },
}
