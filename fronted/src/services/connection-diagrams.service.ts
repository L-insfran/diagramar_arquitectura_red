import api from './api'
import type {
  ApiResponse,
  ConnectionDiagram,
  ConnectionDiagramGraphPayload,
  DiagramContainerState,
  DiagramEdgeRoute,
  DiagramPoint,
  DiagramSettings,
} from '../types'

export type CreateConnectionDiagramPayload = {
  projectId: string
  name: string
  description?: string | null
  scopeSiteIds?: string[]
  scopeAreaIds?: string[]
  sortOrder?: number
  settings?: DiagramSettings
}

export type UpdateConnectionDiagramPayload = {
  name?: string
  description?: string | null
  scopeSiteIds?: string[]
  scopeAreaIds?: string[]
  nodePositions?: Record<string, DiagramPoint>
  labelOffsets?: Record<string, DiagramPoint>
  edgeRoutes?: Record<string, DiagramEdgeRoute>
  containers?: Record<string, DiagramContainerState>
  settings?: DiagramSettings
  sortOrder?: number
}

export const connectionDiagramsService = {
  async getAll(): Promise<ConnectionDiagram[]> {
    const { data } = await api.get<ApiResponse<ConnectionDiagram[]>>('/connection-diagrams')
    return data.data
  },

  async getById(id: string): Promise<ConnectionDiagram> {
    const { data } = await api.get<ApiResponse<ConnectionDiagram>>(`/connection-diagrams/${id}`)
    return data.data
  },

  async getGraph(id: string): Promise<ConnectionDiagramGraphPayload> {
    const { data } = await api.get<ApiResponse<ConnectionDiagramGraphPayload>>(
      `/connection-diagrams/${id}/graph`
    )
    return data.data
  },

  async create(payload: CreateConnectionDiagramPayload): Promise<ConnectionDiagram> {
    const { data } = await api.post<ApiResponse<ConnectionDiagram>>(
      '/connection-diagrams',
      payload
    )
    return data.data
  },

  async update(
    id: string,
    payload: UpdateConnectionDiagramPayload
  ): Promise<ConnectionDiagram> {
    const { data } = await api.put<ApiResponse<ConnectionDiagram>>(
      `/connection-diagrams/${id}`,
      payload
    )
    return data.data
  },

  async duplicate(id: string): Promise<ConnectionDiagram> {
    const { data } = await api.post<ApiResponse<ConnectionDiagram>>(
      `/connection-diagrams/${id}/duplicate`
    )
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/connection-diagrams/${id}`)
  },
}
