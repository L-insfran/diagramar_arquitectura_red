import api from './api'
import type { ApiResponse, Port } from '../types'

export interface CreatePortPayload {
  deviceId: string
  name: string
  portNumber: number
  portType?: Port['portType']
  speed?: string | null
  status?: Port['status']
  description?: string | null
}

/** Fields accepted by PUT /ports/:id (all optional in API; we send a full set from the edit form). */
export interface UpdatePortPayload {
  name: string
  portNumber: number
  portType: Port['portType']
  /** null borra la velocidad en el servidor (undefined se omite en JSON y no actualiza el campo). */
  speed?: string | null
  status: Port['status']
  description?: string
}

export const portsService = {
  async getByDevice(deviceId: string): Promise<Port[]> {
    const { data } = await api.get<ApiResponse<Port[]>>(`/ports?device_id=${deviceId}`)
    return data.data
  },

  async create(payload: CreatePortPayload): Promise<Port> {
    const { data } = await api.post<ApiResponse<Port>>('/ports', payload)
    return data.data
  },

  async update(id: string, payload: UpdatePortPayload): Promise<Port> {
    const { data } = await api.put<ApiResponse<Port>>(`/ports/${id}`, payload)
    return data.data
  },
}
