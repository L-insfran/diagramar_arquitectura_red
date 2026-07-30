import api from './api'
import type { ApiResponse, Area, Site } from '../types'

export type SitePayload = {
  projectId: string
  name: string
  address?: string | null
  notes?: string | null
}

export type AreaPayload = {
  name: string
  notes?: string | null
}

export const sitesService = {
  async getAll(filters?: { search?: string }): Promise<Site[]> {
    const params = new URLSearchParams()
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    const { data } = await api.get<ApiResponse<Site[]>>(`/sites${qs ? `?${qs}` : ''}`)
    return data.data
  },

  async getById(id: string): Promise<Site> {
    const { data } = await api.get<ApiResponse<Site>>(`/sites/${id}`)
    return data.data
  },

  async create(payload: SitePayload): Promise<Site> {
    const { data } = await api.post<ApiResponse<Site>>('/sites', payload)
    return data.data
  },

  async update(
    id: string,
    payload: Partial<Omit<SitePayload, 'projectId'>>
  ): Promise<Site> {
    const { data } = await api.put<ApiResponse<Site>>(`/sites/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/sites/${id}`)
  },

  async getAreas(siteId: string): Promise<Area[]> {
    const { data } = await api.get<ApiResponse<Area[]>>(`/sites/${siteId}/areas`)
    return data.data
  },

  async createArea(siteId: string, payload: AreaPayload): Promise<Area> {
    const { data } = await api.post<ApiResponse<Area>>(`/sites/${siteId}/areas`, payload)
    return data.data
  },

  async updateArea(
    siteId: string,
    areaId: string,
    payload: Partial<AreaPayload>
  ): Promise<Area> {
    const { data } = await api.put<ApiResponse<Area>>(
      `/sites/${siteId}/areas/${areaId}`,
      payload
    )
    return data.data
  },

  async deleteArea(siteId: string, areaId: string): Promise<void> {
    await api.delete(`/sites/${siteId}/areas/${areaId}`)
  },
}
