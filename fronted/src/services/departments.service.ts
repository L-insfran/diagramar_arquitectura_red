import api from './api'
import type { ApiResponse, Department } from '../types'

export const departmentsService = {
  async getAll(companyId?: string): Promise<Department[]> {
    const params = companyId ? `?company_id=${companyId}` : ''
    const { data } = await api.get<ApiResponse<Department[]>>(`/departments${params}`)
    return data.data
  },
}
