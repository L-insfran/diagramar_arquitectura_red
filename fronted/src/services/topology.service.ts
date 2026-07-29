import api from './api'
import type {
  ApiResponse,
  Connection,
  MediumType,
  CableCategory,
  FiberType,
  FiberConnector,
  WifiStandard,
  WifiBand,
  WifiSecurity,
  ConnectionStatusType,
  ConnectionMetadata,
  TopologyPayload,
} from '../types'

export interface CreateConnectionPayload {
  companyId: string
  sourcePortId: string
  targetPortId: string
  connectionType?: 'physical' | 'logical'
  mediumType?: MediumType
  cableCategory?: CableCategory | null
  fiberType?: FiberType | null
  fiberConnector?: FiberConnector | null
  wifiSsid?: string | null
  wifiStandard?: WifiStandard | null
  wifiBand?: WifiBand | null
  wifiSecurity?: WifiSecurity | null
  cableLength?: string | null
  connectionStatus?: ConnectionStatusType
  bandwidth?: string | null
  description?: string | null
  metadata?: ConnectionMetadata | null
}

export interface UpdateConnectionPayload {
  sourcePortId?: string
  targetPortId?: string
  connectionType?: 'physical' | 'logical'
  mediumType?: MediumType
  cableCategory?: CableCategory | null
  fiberType?: FiberType | null
  fiberConnector?: FiberConnector | null
  wifiSsid?: string | null
  wifiStandard?: WifiStandard | null
  wifiBand?: WifiBand | null
  wifiSecurity?: WifiSecurity | null
  cableLength?: string | null
  connectionStatus?: ConnectionStatusType
  bandwidth?: string | null
  description?: string | null
  metadata?: ConnectionMetadata | null
}

export type TopologyWorkAreaPayload = {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  titleFontSize?: number
}

export type TopologyCanvasLayoutPayload = {
  nodePositions: Record<string, { x: number; y: number }>
  labelOffsets: Record<string, { x: number; y: number }>
  workAreas?: TopologyWorkAreaPayload[]
  nodeParents?: Record<string, string>
}

export const topologyService = {
  async getCanvasLayout(companyId: string): Promise<TopologyCanvasLayoutPayload> {
    const { data } = await api.get<ApiResponse<TopologyCanvasLayoutPayload>>(
      `/topology/canvas-layout?company_id=${encodeURIComponent(companyId)}`
    )
    return data.data
  },

  async saveCanvasLayout(payload: {
    companyId: string
    nodePositions: Record<string, { x: number; y: number }>
    labelOffsets: Record<string, { x: number; y: number }>
    workAreas?: TopologyWorkAreaPayload[]
    nodeParents?: Record<string, string>
  }): Promise<TopologyCanvasLayoutPayload> {
    const { data } = await api.put<ApiResponse<TopologyCanvasLayoutPayload>>('/topology/canvas-layout', payload)
    return data.data
  },

  async clearCanvasLayout(companyId: string): Promise<void> {
    await api.delete(
      `/topology/canvas-layout?company_id=${encodeURIComponent(companyId)}`
    )
  },

  async getTopology(companyId?: string): Promise<TopologyPayload> {
    const params = companyId ? `?company_id=${companyId}` : ''
    const { data } = await api.get<ApiResponse<TopologyPayload>>(`/topology${params}`)
    return data.data
  },

  async createConnection(payload: CreateConnectionPayload): Promise<Connection> {
    const { data } = await api.post<ApiResponse<Connection>>('/topology', payload)
    return data.data
  },

  async updateConnection(id: string, payload: UpdateConnectionPayload): Promise<Connection> {
    const { data } = await api.put<ApiResponse<Connection>>(`/topology/${id}`, payload)
    return data.data
  },

  async deleteConnection(id: string): Promise<void> {
    await api.delete(`/topology/${id}`)
  },
}
