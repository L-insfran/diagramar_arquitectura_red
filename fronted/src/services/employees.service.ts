import api from './api'
import type { ApiResponse, Employee } from '../types'

export const employeesService = {
  async getAll(projectId?: string): Promise<Employee[]> {
    const params = projectId ? `?project_id=${projectId}` : ''
    const { data } = await api.get<ApiResponse<Employee[]>>(`/employees${params}`)
    return data.data
  },

  async getById(id: string): Promise<Employee> {
    const { data } = await api.get<ApiResponse<Employee>>(`/employees/${id}`)
    return data.data
  },

  async create(payload: Partial<Employee>): Promise<Employee> {
    const { data } = await api.post<ApiResponse<Employee>>('/employees', payload)
    return data.data
  },

  async update(id: string, payload: Partial<Employee>): Promise<Employee> {
    const { data } = await api.put<ApiResponse<Employee>>(`/employees/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/employees/${id}`)
  },
}
