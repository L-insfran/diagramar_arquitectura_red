import api from './api'
import type {
  ApiResponse,
  Device,
  DeviceFilterOptions,
  DeviceFilters,
  DeviceListPage,
  DeviceRelocationImpact,
} from '../types'

export type UpdateDevicePayload = Partial<Device> & {
  confirmDiagramRelocate?: boolean
}

function deviceListParams(filters?: DeviceFilters) {
  const params = new URLSearchParams()
  if (filters?.status) params.set('status', filters.status)
  if (filters?.deviceTypeId) params.set('deviceTypeId', filters.deviceTypeId)
  if (filters?.deviceTemplateId) params.set('deviceTemplateId', filters.deviceTemplateId)
  if (filters?.siteId) params.set('siteId', filters.siteId)
  if (filters?.areaId) params.set('areaId', filters.areaId)
  if (filters?.containerId) params.set('containerId', filters.containerId)
  if (filters?.rackId) params.set('rackId', filters.rackId)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.projectId) params.set('projectId', filters.projectId)
  if (filters?.summary) params.set('summary', '1')
  return params
}

export const devicesService = {
  async getFilterOptions(): Promise<DeviceFilterOptions> {
    const { data } = await api.get<ApiResponse<DeviceFilterOptions>>('/devices/filter-options')
    return data.data
  },

  async getAll(filters?: DeviceFilters): Promise<Device[]> {
    const { data } = await api.get<ApiResponse<Device[]>>(`/devices?${deviceListParams(filters)}`)
    return data.data
  },

  async getPage(filters: DeviceFilters & { page: number }): Promise<DeviceListPage> {
    const params = deviceListParams(filters)
    params.set('page', String(filters.page))
    params.set('perPage', String(filters.perPage ?? 50))
    const { data } = await api.get<ApiResponse<DeviceListPage>>(`/devices?${params}`)
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

  async update(id: string, payload: UpdateDevicePayload): Promise<Device> {
    const { data } = await api.put<ApiResponse<Device>>(`/devices/${id}`, payload)
    return data.data
  },

  async getRelocationImpact(
    id: string,
    areaId: string | null,
    containerId?: string | null,
  ): Promise<DeviceRelocationImpact> {
    const params = new URLSearchParams()
    if (areaId) params.set('areaId', areaId)
    if (containerId) params.set('containerId', containerId)
    const { data } = await api.get<ApiResponse<DeviceRelocationImpact>>(
      `/devices/${id}/relocation-impact?${params}`,
    )
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/devices/${id}`)
  },

  async assignContainer(
    id: string,
    payload: { containerId?: string | null; areaId?: string | null },
  ): Promise<Device> {
    const { data } = await api.post<ApiResponse<Device>>(
      `/devices/${id}/assign-container`,
      payload,
    )
    return data.data
  },
}
