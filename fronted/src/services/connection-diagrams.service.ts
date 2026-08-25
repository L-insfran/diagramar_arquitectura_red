import api from './api'
import type {
  ApiResponse,
  ConnectionDiagram,
  ConnectionDiagramGraphPayload,
  DiagramContainerState,
  DiagramEdgeRoute,
  DiagramHandleAnchor,
  DiagramLayoutState,
  DiagramNodePosition,
  DiagramPoint,
  DiagramLayoutMode,
  DiagramSettings,
} from '../types'

export type CreateConnectionDiagramPayload = {
  projectId: string
  name: string
  description?: string | null
  scopeSiteIds?: string[]
  scopeAreaIds?: string[]
  sortOrder?: number
  layoutMode?: DiagramLayoutMode
  settings?: DiagramSettings
}

export type UpdateConnectionDiagramPayload = {
  name?: string
  description?: string | null
  scopeSiteIds?: string[]
  scopeAreaIds?: string[]
  nodePositions?: Record<string, DiagramNodePosition>
  labelOffsets?: Record<string, DiagramPoint>
  edgeRoutes?: Record<string, DiagramEdgeRoute>
  containers?: Record<string, DiagramContainerState>
  handleAnchors?: Record<string, DiagramHandleAnchor>
  treeLayout?: DiagramLayoutState
  layoutMode?: DiagramLayoutMode
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
    const { data } = await api.get<ApiResponse<any>>(
      `/connection-diagrams/${id}/graph`
    )
    const raw = data.data

    // Backend returns unified `containers`; frontend expects `racks` + `boards`
    const containers: any[] = raw.containers ?? []
    const racks = containers
      .filter((c: any) => c.kind === 'rack')
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        heightU: c.heightU,
        areaId: c.areaId,
        siteId: c.siteId,
        areaName: c.areaName,
        siteName: c.siteName,
        accessories: c.accessories,
      }))
    const boards = containers
      .filter((c: any) => c.kind === 'board')
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        kind: c.boardKind,
        gridRows: c.gridRows,
        gridCols: c.gridCols,
        areaId: c.areaId,
        siteId: c.siteId,
        areaName: c.areaName,
        siteName: c.siteName,
      }))

    return {
      ...raw,
      racks,
      boards,
    }
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
