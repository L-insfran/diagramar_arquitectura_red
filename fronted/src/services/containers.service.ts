import api from './api'
import type { ApiResponse, Container } from '../types'

export type ContainerPayload = {
  projectId: string
  areaId: string
  kind: 'rack' | 'board' | 'default'
  name: string
  code?: string | null
  heightU?: number | null
  boardKind?: string | null
  gridRows?: number | null
  gridCols?: number | null
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export const containersService = {
  async getAll(filters?: {
    areaId?: string
    siteId?: string
    kind?: string
    search?: string
  }): Promise<Container[]> {
    const params = new URLSearchParams()
    if (filters?.areaId) params.set('areaId', filters.areaId)
    if (filters?.siteId) params.set('siteId', filters.siteId)
    if (filters?.kind) params.set('kind', filters.kind)
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    const { data } = await api.get<ApiResponse<Container[]>>(`/containers${qs ? `?${qs}` : ''}`)
    return data.data
  },

  async getById(id: string): Promise<Container> {
    const { data } = await api.get<ApiResponse<Container>>(`/containers/${id}`)
    return data.data
  },

  async create(payload: ContainerPayload): Promise<Container> {
    const { data } = await api.post<ApiResponse<Container>>('/containers', payload)
    return data.data
  },

  async update(
    id: string,
    payload: Partial<Omit<ContainerPayload, 'projectId'>>
  ): Promise<Container> {
    const { data } = await api.put<ApiResponse<Container>>(`/containers/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/containers/${id}`)
  },

  async moveDevices(
    sourceId: string,
    targetContainerId: string,
    deviceIds?: string[],
  ): Promise<void> {
    await api.post(`/containers/${sourceId}/move-devices`, {
      targetContainerId,
      ...(deviceIds ? { deviceIds } : {}),
    })
  },
}
