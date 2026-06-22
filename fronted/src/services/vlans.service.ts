import api from './api'
import type { ApiResponse, Vlan } from '../types'

export const vlansService = {
  async getAll(companyId?: string): Promise<Vlan[]> {
    const params = companyId ? `?company_id=${companyId}` : ''
    const { data } = await api.get<ApiResponse<Vlan[]>>(`/vlans${params}`)
    return data.data
  },

  async getById(id: string): Promise<Vlan> {
    const { data } = await api.get<ApiResponse<Vlan>>(`/vlans/${id}`)
    return data.data
  },

  async create(payload: Partial<Vlan>): Promise<Vlan> {
    const { data } = await api.post<ApiResponse<Vlan>>('/vlans', payload)
    return data.data
  },

  async update(id: string, payload: Partial<Vlan>): Promise<Vlan> {
    const { data } = await api.put<ApiResponse<Vlan>>(`/vlans/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/vlans/${id}`)
  },
}
