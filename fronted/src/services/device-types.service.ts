import api from './api'
import type { ApiResponse, DeviceType } from '../types'

export const deviceTypesService = {
  async getAll(): Promise<DeviceType[]> {
    const { data } = await api.get<ApiResponse<DeviceType[]>>('/device-types')
    return data.data
  },

  async create(payload: Partial<DeviceType>): Promise<DeviceType> {
    const { data } = await api.post<ApiResponse<DeviceType>>('/device-types', payload)
    return data.data
  },

  async update(id: string, payload: Partial<DeviceType>): Promise<DeviceType> {
    const { data } = await api.put<ApiResponse<DeviceType>>(`/device-types/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/device-types/${id}`)
  },
}
