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
}
