import api from './api'
import type { ApiResponse, Device, DeviceFilters } from '../types'

export const devicesService = {
  async getAll(filters?: DeviceFilters): Promise<Device[]> {
    const params = new URLSearchParams()
    if (filters?.status) params.set('status', filters.status)
    if (filters?.deviceTypeId) params.set('deviceTypeId', filters.deviceTypeId)
    if (filters?.deviceTemplateId) params.set('deviceTemplateId', filters.deviceTemplateId)
    if (filters?.siteId) params.set('siteId', filters.siteId)
    if (filters?.areaId) params.set('areaId', filters.areaId)
    if (filters?.rackId) params.set('rackId', filters.rackId)
    if (filters?.search) params.set('search', filters.search)
    if (filters?.projectId) params.set('projectId', filters.projectId)
    const { data } = await api.get<ApiResponse<Device[]>>(`/devices?${params}`)
    return data.data
  },

  async getById(id: string): Promise<Device> {
    const { data } = await api.get<ApiResponse<Device>>(`/devices/${id}`)
    return data.data
  },

  async create(payload: Partial<Device>): Promise<Device> {
    const { data } = await api.post<ApiResponse<Device>>('/devices', payload)
    return data.data
  },

  async update(id: string, payload: Partial<Device>): Promise<Device> {
    const { data } = await api.put<ApiResponse<Device>>(`/devices/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/devices/${id}`)
  },
}
