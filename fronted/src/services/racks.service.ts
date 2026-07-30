import api from './api'
import type { ApiResponse, Rack, RackOccupancy } from '../types'

export type RackPayload = {
  projectId: string
  areaId: string
  name: string
  code?: string | null
  heightU?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export const racksService = {
  async getAll(filters?: {
    areaId?: string
    siteId?: string
    search?: string
  }): Promise<Rack[]> {
    const params = new URLSearchParams()
    if (filters?.areaId) params.set('areaId', filters.areaId)
    if (filters?.siteId) params.set('siteId', filters.siteId)
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    const { data } = await api.get<ApiResponse<Rack[]>>(`/racks${qs ? `?${qs}` : ''}`)
    return data.data
  },

  async getById(id: string): Promise<Rack> {
    const { data } = await api.get<ApiResponse<Rack>>(`/racks/${id}`)
    return data.data
  },

  async getOccupancy(id: string): Promise<RackOccupancy> {
    const { data } = await api.get<ApiResponse<RackOccupancy>>(`/racks/${id}/occupancy`)
    return data.data
  },

  async create(payload: RackPayload): Promise<Rack> {
    const { data } = await api.post<ApiResponse<Rack>>('/racks', payload)
    return data.data
  },

  async update(
    id: string,
    payload: Partial<Omit<RackPayload, 'projectId'>>
  ): Promise<Rack> {
    const { data } = await api.put<ApiResponse<Rack>>(`/racks/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/racks/${id}`)
  },
}
