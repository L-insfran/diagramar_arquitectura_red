import api from './api'
import type { ApiResponse, AccessibleProject, Project, ProjectMembershipSummary } from '../types'

export type CreateProjectPayload = {
  name: string
  domain?: string | null
  address?: string | null
  phone?: string | null
}

export type UpdateProjectPayload = Partial<CreateProjectPayload> & {
  isActive?: boolean
}

export const projectsService = {
  async getAll(): Promise<Project[]> {
    const { data } = await api.get<ApiResponse<Project[]>>('/projects')
    return data.data
  },

  async getMine(): Promise<AccessibleProject[]> {
    const { data } = await api.get<ApiResponse<AccessibleProject[]>>('/me/projects')
    return data.data
  },

  async getById(id: string): Promise<Project> {
    const { data } = await api.get<ApiResponse<Project>>(`/projects/${id}`)
    return data.data
  },

  async create(payload: CreateProjectPayload): Promise<Project> {
    const { data } = await api.post<ApiResponse<Project>>('/projects', payload)
    return data.data
  },

  async update(id: string, payload: UpdateProjectPayload): Promise<Project> {
    const { data } = await api.put<ApiResponse<Project>>(`/projects/${id}`, payload)
    return data.data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/projects/${id}`)
  },

  async getUserMemberships(userId: string): Promise<ProjectMembershipSummary[]> {
    const { data } = await api.get<ApiResponse<ProjectMembershipSummary[]>>(
      `/system-users/${userId}/memberships`
    )
    return data.data
  },

  async updateUserMemberships(
    userId: string,
    memberships: Array<{
      projectId: string
      role: 'admin' | 'operator' | 'viewer'
      isDefault?: boolean
    }>
  ): Promise<ProjectMembershipSummary[]> {
    const { data } = await api.put<ApiResponse<ProjectMembershipSummary[]>>(
      `/system-users/${userId}/memberships`,
      { memberships }
    )
    return data.data
  },
}
