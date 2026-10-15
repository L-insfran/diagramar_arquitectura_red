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

export type ConnectionSheetLayout = 'tabs' | 'combined'

function saveWorkbook(disposition: unknown, data: Blob, fallback: string) {
  const match = typeof disposition === 'string' ? /filename="([^"]+)"/.exec(disposition) : null
  const filename = match?.[1] || fallback
  const url = window.URL.createObjectURL(data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  window.URL.revokeObjectURL(url)
}

async function readBlobError(error: unknown): Promise<string> {
  const data = (error as { response?: { data?: unknown } }).response?.data
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text()) as { message?: string }
      if (parsed.message) return parsed.message
    } catch {
      /* el cuerpo no era JSON */
    }
  }
  return 'No se pudo descargar la planilla de conexiones'
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

  async downloadConnectionSheet(id: string): Promise<void> {
    const response = await api.get(`/devices/${id}/connection-sheet`, {
      responseType: 'blob',
    })
    saveWorkbook(response.headers['content-disposition'], response.data, 'conexiones.xlsx')
  },

  async downloadConnectionSheets(
    deviceIds: string[],
    layout: ConnectionSheetLayout,
  ): Promise<void> {
    try {
      const response = await api.post(
        '/devices/connection-sheets',
        { deviceIds, layout },
        { responseType: 'blob' },
      )
      saveWorkbook(response.headers['content-disposition'], response.data, 'conexiones-grupo.xlsx')
    } catch (error) {
      throw new Error(await readBlobError(error))
    }
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
