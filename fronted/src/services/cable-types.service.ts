import api from './api'
import type { ApiResponse, CableType } from '../types'

export type CableTypePayload = {
  code?: string
  name: string
  description?: string | null
  mediumFamily?: CableType['mediumFamily']
  defaultCategory?: string | null
  defaultFiberType?: string | null
  color?: string | null
  sortOrder?: number
}

export const cableTypesService = {
  async getAll(): Promise<CableType[]> {
    const { data } = await api.get<ApiResponse<CableType[]>>('/cable-types')
    return data.data
  },

  async create(
    payload: CableTypePayload & { code: string; mediumFamily: CableType['mediumFamily'] }
  ): Promise<CableType> {
    const { data } = await api.post<ApiResponse<CableType>>('/cable-types', payload)
    return data.data
  },

  async update(id: string, payload: CableTypePayload): Promise<CableType> {
    const { data } = await api.put<ApiResponse<CableType>>(`/cable-types/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/cable-types/${id}`)
  },
}
