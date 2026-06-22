import api from './api'
import type { ApiResponse, EmployeeCredential } from '../types'

export interface CreateCredentialPayload {
  employeeId: string
  companyId: string
  kind?: EmployeeCredential['kind']
  label?: string
  username: string
  password: string
  notes?: string
}

export interface UpdateCredentialPayload {
  kind?: EmployeeCredential['kind']
  label?: string | null
  username?: string
  password?: string
  notes?: string | null
}

export const employeeCredentialsService = {
  async getByEmployee(employeeId: string): Promise<EmployeeCredential[]> {
    const { data } = await api.get<ApiResponse<EmployeeCredential[]>>(
      `/employee-credentials?employee_id=${employeeId}`
    )
    return data.data
  },

  async create(payload: CreateCredentialPayload): Promise<EmployeeCredential> {
    const { data } = await api.post<ApiResponse<EmployeeCredential>>('/employee-credentials', payload)
    return data.data
  },

  async reveal(id: string): Promise<string> {
    const { data } = await api.get<ApiResponse<{ password: string }>>(
      `/employee-credentials/${id}/reveal`
    )
    return data.data.password
  },

  async update(id: string, payload: UpdateCredentialPayload): Promise<EmployeeCredential> {
    const { data } = await api.put<ApiResponse<EmployeeCredential>>(
      `/employee-credentials/${id}`,
      payload
    )
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/employee-credentials/${id}`)
  },
}
