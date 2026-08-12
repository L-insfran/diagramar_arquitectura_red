import api from './api'
import type { ApiResponse, Board, BoardOccupancy, BoardKind } from '../types'

export type BoardPayload = {
  projectId: string
  areaId: string
  name: string
  code?: string | null
  kind?: BoardKind
  gridRows?: number
  gridCols?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export const boardsService = {
  async getAll(filters?: {
    areaId?: string
    siteId?: string
    search?: string
  }): Promise<Board[]> {
    const params = new URLSearchParams()
    if (filters?.areaId) params.set('areaId', filters.areaId)
    if (filters?.siteId) params.set('siteId', filters.siteId)
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    const { data } = await api.get<ApiResponse<Board[]>>(`/boards${qs ? `?${qs}` : ''}`)
    return data.data
  },

  async getById(id: string): Promise<Board> {
    const { data } = await api.get<ApiResponse<Board>>(`/boards/${id}`)
    return data.data
  },

  async getOccupancy(id: string): Promise<BoardOccupancy> {
    const { data } = await api.get<ApiResponse<BoardOccupancy>>(`/boards/${id}/occupancy`)
    return data.data
  },

  async create(payload: BoardPayload): Promise<Board> {
    const { data } = await api.post<ApiResponse<Board>>('/boards', payload)
    return data.data
  },

  async update(
    id: string,
    payload: Partial<Omit<BoardPayload, 'projectId'>>
  ): Promise<Board> {
    const { data } = await api.put<ApiResponse<Board>>(`/boards/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/boards/${id}`)
  },
}
