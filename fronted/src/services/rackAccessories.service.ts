import api from './api'
import type {
  ApiResponse,
  RackAccessory,
  RackAccessoryTemplate,
  ShelfMountType,
} from '../types'

export type RackAccessoryPayload = {
  projectId: string
  rackId: string
  accessoryTemplateId?: string | null
  name: string
  kind?: 'shelf'
  unitStart: number
  heightU: 1 | 2
  mountType: ShelfMountType
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export const rackAccessoryTemplatesService = {
  async getAll(): Promise<RackAccessoryTemplate[]> {
    const { data } = await api.get<ApiResponse<RackAccessoryTemplate[]>>(
      '/rack-accessory-templates'
    )
    return data.data
  },
}

export const rackAccessoriesService = {
  async getAll(filters?: { rackId?: string; kind?: 'shelf'; search?: string }): Promise<
    RackAccessory[]
  > {
    const params = new URLSearchParams()
    if (filters?.rackId) params.set('rackId', filters.rackId)
    if (filters?.kind) params.set('kind', filters.kind)
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    const { data } = await api.get<ApiResponse<RackAccessory[]>>(
      `/rack-accessories${qs ? `?${qs}` : ''}`
    )
    return data.data
  },

  async getById(id: string): Promise<RackAccessory> {
    const { data } = await api.get<ApiResponse<RackAccessory>>(`/rack-accessories/${id}`)
    return data.data
  },

  async create(payload: RackAccessoryPayload): Promise<RackAccessory> {
    const { data } = await api.post<ApiResponse<RackAccessory>>('/rack-accessories', payload)
    return data.data
  },

  async update(
    id: string,
    payload: Partial<Omit<RackAccessoryPayload, 'projectId' | 'rackId'>>
  ): Promise<RackAccessory> {
    const { data } = await api.put<ApiResponse<RackAccessory>>(`/rack-accessories/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/rack-accessories/${id}`)
  },
}
