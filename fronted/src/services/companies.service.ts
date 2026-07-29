import api from './api'
import type { ApiResponse, AccessibleCompany, Company, CompanyMembershipSummary } from '../types'

export type CreateCompanyPayload = {
  name: string
  domain?: string | null
  address?: string | null
  phone?: string | null
}

export type UpdateCompanyPayload = Partial<CreateCompanyPayload> & {
  isActive?: boolean
}

export const companiesService = {
  async getAll(): Promise<Company[]> {
    const { data } = await api.get<ApiResponse<Company[]>>('/companies')
    return data.data
  },

  async getMine(): Promise<AccessibleCompany[]> {
    const { data } = await api.get<ApiResponse<AccessibleCompany[]>>('/me/companies')
    return data.data
  },

  async getById(id: string): Promise<Company> {
    const { data } = await api.get<ApiResponse<Company>>(`/companies/${id}`)
    return data.data
  },

  async create(payload: CreateCompanyPayload): Promise<Company> {
    const { data } = await api.post<ApiResponse<Company>>('/companies', payload)
    return data.data
  },

  async update(id: string, payload: UpdateCompanyPayload): Promise<Company> {
    const { data } = await api.put<ApiResponse<Company>>(`/companies/${id}`, payload)
    return data.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/companies/${id}`)
  },

  async getUserMemberships(userId: string): Promise<CompanyMembershipSummary[]> {
    const { data } = await api.get<ApiResponse<CompanyMembershipSummary[]>>(
      `/system-users/${userId}/memberships`
    )
    return data.data
  },

  async updateUserMemberships(
    userId: string,
    memberships: Array<{ companyId: string; role: 'admin' | 'operator' | 'viewer'; isDefault?: boolean }>
  ): Promise<CompanyMembershipSummary[]> {
    const { data } = await api.put<ApiResponse<CompanyMembershipSummary[]>>(
      `/system-users/${userId}/memberships`,
      { memberships }
    )
    return data.data
  },
}
