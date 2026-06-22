import api from './api'
import type { ApiResponse, AuthResponse, SystemUser } from '../types'

export const authService = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/auth/login', { email, password })
    return data.data
  },

  async register(payload: { email: string; password: string; firstName: string; lastName: string; companyId: string }): Promise<AuthResponse> {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/auth/register', payload)
    return data.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async me(): Promise<SystemUser> {
    const { data } = await api.get<ApiResponse<SystemUser>>('/auth/me')
    return data.data
  },
}
