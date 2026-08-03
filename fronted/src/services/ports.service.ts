import api from './api'
import type { ApiResponse, Port } from '../types'

export interface PortVlanAssignment {
  vlanId: string
  isTagged?: boolean
}

export interface CreatePortPayload {
  deviceId: string
  name: string
  portNumber: number
  portType?: Port['portType']
  speed?: string | null
  status?: Port['status']
  description?: string | null
  isPassthrough?: boolean
  chassisFace?: 'front' | 'rear'
  vlanAssignments?: PortVlanAssignment[]
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
  isPassthrough?: boolean
  chassisFace?: 'front' | 'rear'
  /** Si se envía (aunque sea []), reemplaza las VLANs del puerto. */
  vlanAssignments?: PortVlanAssignment[]
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

  /** Set all ports of a device to up or down. */
  async bulkUpdateStatus(
    deviceId: string,
    status: 'up' | 'down'
  ): Promise<{ updatedCount: number }> {
    const { data } = await api.put<ApiResponse<{ updatedCount: number }>>(
      `/devices/${deviceId}/ports/status`,
      { status }
    )
    return data.data
  },

  /** Set is_passthrough on every port of a device. */
  async bulkUpdatePassthrough(
    deviceId: string,
    isPassthrough: boolean
  ): Promise<{ updatedCount: number }> {
    const { data } = await api.put<ApiResponse<{ updatedCount: number }>>(
      `/devices/${deviceId}/ports/passthrough`,
      { isPassthrough }
    )
    return data.data
  },
}
