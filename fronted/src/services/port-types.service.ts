import api from './api'
import type { ApiResponse, PortType } from '../types'

export type PortTypePayload = {
  code?: string
  name: string
  description?: string | null
  defaultSpeed?: string | null
  color?: string | null
  icon?: string | null
  direction?: 'in' | 'out' | 'bidirectional'
}

export const portTypesService = {
  async getAll(): Promise<PortType[]> {
    const { data } = await api.get<ApiResponse<PortType[]>>('/port-types')
    return data.data
  },

  async create(payload: PortTypePayload & { code: string }): Promise<PortType> {
    const { data } = await api.post<ApiResponse<PortType>>('/port-types', payload)
    return data.data
  },

  async update(id: string, payload: PortTypePayload): Promise<PortType> {
    const { data } = await api.put<ApiResponse<PortType>>(`/port-types/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/port-types/${id}`)
  },
}
