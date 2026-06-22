import api from './api'
import type { ApiResponse, Company } from '../types'

export const companiesService = {
  async getAll(): Promise<Company[]> {
    const { data } = await api.get<ApiResponse<Company[]>>('/companies')
    return data.data
  },

  async getById(id: string): Promise<Company> {
    const { data } = await api.get<ApiResponse<Company>>(`/companies/${id}`)
    return data.data
  },
}
