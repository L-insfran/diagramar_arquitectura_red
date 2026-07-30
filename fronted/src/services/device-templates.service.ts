import api from './api'
import type { ApiResponse, DeviceTemplate, DeviceTemplatePort } from '../types'

export type DeviceTemplatePayload = {
  deviceTypeId: string
  name: string
  manufacturer?: string | null
  model?: string | null
  rackUnits?: number | null
  imageUrl?: string | null
  frontViewUrl?: string | null
  rearViewUrl?: string | null
  powerConsumptionW?: number | null
  weightKg?: number | null
  notes?: string | null
}

export type DeviceTemplatePortPayload = {
  name: string
  portNumber: number
  portType: string
  speed?: string | null
  description?: string | null
}

export const deviceTemplatesService = {
  async getAll(filters?: { deviceTypeId?: string; search?: string }): Promise<DeviceTemplate[]> {
    const params = new URLSearchParams()
    if (filters?.deviceTypeId) params.set('deviceTypeId', filters.deviceTypeId)
    if (filters?.search) params.set('search', filters.search)
    const qs = params.toString()
    const { data } = await api.get<ApiResponse<DeviceTemplate[]>>(
      `/device-templates${qs ? `?${qs}` : ''}`
    )
    return data.data
  },

  async getById(id: string): Promise<DeviceTemplate> {
    const { data } = await api.get<ApiResponse<DeviceTemplate>>(`/device-templates/${id}`)
    return data.data
  },

  async create(payload: DeviceTemplatePayload): Promise<DeviceTemplate> {
    const { data } = await api.post<ApiResponse<DeviceTemplate>>('/device-templates', payload)
    return data.data
  },

  async update(id: string, payload: Partial<DeviceTemplatePayload>): Promise<DeviceTemplate> {
    const { data } = await api.put<ApiResponse<DeviceTemplate>>(
      `/device-templates/${id}`,
      payload
    )
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/device-templates/${id}`)
  },

  async getPorts(templateId: string): Promise<DeviceTemplatePort[]> {
    const { data } = await api.get<ApiResponse<DeviceTemplatePort[]>>(
      `/device-templates/${templateId}/ports`
    )
    return data.data
  },

  async createPort(
    templateId: string,
    payload: DeviceTemplatePortPayload
  ): Promise<DeviceTemplatePort> {
    const { data } = await api.post<ApiResponse<DeviceTemplatePort>>(
      `/device-templates/${templateId}/ports`,
      payload
    )
    return data.data
  },

  async updatePort(
    templateId: string,
    portId: string,
    payload: Partial<DeviceTemplatePortPayload>
  ): Promise<DeviceTemplatePort> {
    const { data } = await api.put<ApiResponse<DeviceTemplatePort>>(
      `/device-templates/${templateId}/ports/${portId}`,
      payload
    )
    return data.data
  },

  async deletePort(templateId: string, portId: string): Promise<void> {
    await api.delete(`/device-templates/${templateId}/ports/${portId}`)
  },
}
