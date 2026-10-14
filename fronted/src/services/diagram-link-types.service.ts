import api from './api'
import type { ApiResponse, DiagramLinkType } from '../types'

export type DiagramLinkTypePayload = {
  name: string
  color: string
  description?: string | null
  sortOrder?: number
  isDefault?: boolean
  lineStyle?: DiagramLinkType['lineStyle']
}

export const diagramLinkTypesService = {
  async getAll(): Promise<DiagramLinkType[]> {
    const { data } = await api.get<ApiResponse<DiagramLinkType[]>>('/diagram-link-types')
    return data.data
  },

  async create(payload: DiagramLinkTypePayload): Promise<DiagramLinkType> {
    const { data } = await api.post<ApiResponse<DiagramLinkType>>('/diagram-link-types', payload)
    return data.data
  },

  async update(id: string, payload: Partial<DiagramLinkTypePayload>): Promise<DiagramLinkType> {
    const { data } = await api.put<ApiResponse<DiagramLinkType>>(
      `/diagram-link-types/${id}`,
      payload
    )
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/diagram-link-types/${id}`)
  },
}
