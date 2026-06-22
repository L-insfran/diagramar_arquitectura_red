import api from './api'
import type { ApiResponse, SystemUser } from '../types'

export interface CreateSystemUserPayload {
  companyId: string
  email: string
  password: string
  firstName: string
  lastName: string
  role: SystemUser['role']
  isActive?: boolean
}

export interface UpdateSystemUserPayload {
  email?: string
  password?: string
  firstName?: string
  lastName?: string
  role?: SystemUser['role']
  isActive?: boolean
}

export const systemUsersService = {
  async getAll(companyId?: string): Promise<SystemUser[]> {
    const params = companyId ? `?company_id=${companyId}` : ''
    const { data } = await api.get<ApiResponse<SystemUser[]>>(`/system-users${params}`)
    return data.data
  },

  async create(payload: CreateSystemUserPayload): Promise<SystemUser> {
    const { data } = await api.post<ApiResponse<SystemUser>>('/system-users', payload)
    return data.data
  },

  async update(id: string, payload: UpdateSystemUserPayload): Promise<SystemUser> {
    const { data } = await api.put<ApiResponse<SystemUser>>(`/system-users/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/system-users/${id}`)
  },
}
