import api from './api'
import type { ApiResponse, Department } from '../types'

export const departmentsService = {
  async getAll(projectId?: string): Promise<Department[]> {
    const params = projectId ? `?project_id=${projectId}` : ''
    const { data } = await api.get<ApiResponse<Department[]>>(`/departments${params}`)
    return data.data
  },
}
