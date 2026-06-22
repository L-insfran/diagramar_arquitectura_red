import api from './api'
import type { ApiResponse, Network } from '../types'

export const networksService = {
  async getAll(companyId?: string): Promise<Network[]> {
    const params = companyId ? `?company_id=${companyId}` : ''
    const { data } = await api.get<ApiResponse<Network[]>>(`/networks${params}`)
    return data.data
  },

  async getById(id: string): Promise<Network> {
    const { data } = await api.get<ApiResponse<Network>>(`/networks/${id}`)
    return data.data
  },

  async create(payload: Partial<Network>): Promise<Network> {
    const { data } = await api.post<ApiResponse<Network>>('/networks', payload)
    return data.data
  },

  async update(id: string, payload: Partial<Network>): Promise<Network> {
    const { data } = await api.put<ApiResponse<Network>>(`/networks/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/networks/${id}`)
  },
}
