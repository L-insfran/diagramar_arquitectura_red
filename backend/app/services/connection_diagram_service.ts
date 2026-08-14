import { Exception } from '@adonisjs/core/exceptions'
import ConnectionDiagramRepository from '#repositories/connection_diagram_repository'
import TopologyService from '#services/topology_service'
import DiagramLinkService from '#services/diagram_link_service'
import Board from '#models/board'
import Area from '#models/area'
import type {
  CreateConnectionDiagramInput,
  UpdateConnectionDiagramInput,
} from '#dtos/connection_diagram_dto'

type TopologyBoardSummary = {
  id: string
  name: string
  code: string | null
  kind: string
  gridRows: number
  gridCols: number
  areaId: string
  siteId: string | null
  areaName: string | null
  siteName: string | null
}

type TopologyAreaSummary = {
  id: string
  name: string
  siteId: string
  siteName: string | null
}

export default class ConnectionDiagramService {
  private diagrams = new ConnectionDiagramRepository()
  private topology = new TopologyService()
  private diagramLinks = new DiagramLinkService()

  async getAllByProject(projectId: string) {
    return this.diagrams.findAllByProject(projectId)
  }

  async getById(id: string) {
    return this.diagrams.findByIdOrFail(id)
  }

  async create(data: CreateConnectionDiagramInput, actorId: string) {
    const existing = await this.diagrams.findByNameInProject(data.projectId, data.name)
    if (existing) {
      throw new Exception('Ya existe un diagrama con ese nombre en el proyecto', { status: 409 })
    }
    const diagram = await this.diagrams.create({
      ...data,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.diagrams.findByIdOrFail(diagram.id)
  }

  async update(id: string, data: UpdateConnectionDiagramInput, actorId: string) {
    const diagram = await this.diagrams.findByIdOrFail(id)
    if (data.name) {
      const clash = await this.diagrams.findByNameInProject(diagram.projectId, data.name, id)
      if (clash) {
        throw new Exception('Ya existe un diagrama con ese nombre en el proyecto', { status: 409 })
      }
    }
    await this.diagrams.update(diagram, { ...data, updatedBy: actorId })
    return this.diagrams.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const diagram = await this.diagrams.findByIdOrFail(id)
    await this.diagrams.softDelete(diagram, actorId)
  }

  async duplicate(id: string, actorId: string) {
    const source = await this.diagrams.findByIdOrFail(id)
    let name = `${source.name} (copia)`
    let attempt = 2
    while (await this.diagrams.findByNameInProject(source.projectId, name)) {
      name = `${source.name} (copia ${attempt})`
      attempt++
    }

    const copy = await this.diagrams.create({
      projectId: source.projectId,
      name,
      description: source.description,
      scopeSiteIds: [...(source.scopeSiteIds ?? [])],
      scopeAreaIds: [...(source.scopeAreaIds ?? [])],
      settings: { ...(source.settings ?? {}) },
      sortOrder: (source.sortOrder ?? 0) + 1,
      createdBy: actorId,
      updatedBy: actorId,
    })

    await this.diagrams.update(copy, {
      nodePositions: { ...(source.nodePositions ?? {}) },
      labelOffsets: { ...(source.labelOffsets ?? {}) },
      edgeRoutes: { ...(source.edgeRoutes ?? {}) },
      containers: { ...(source.containers ?? {}) },
      updatedBy: actorId,
    })

    return this.diagrams.findByIdOrFail(copy.id)
  }

  async getGraph(id: string, actorId?: string) {
    const diagram = await this.diagrams.findByIdOrFail(id)
    if (actorId) {
      await this.diagramLinks.softDeleteOrphansWithDeletedDevices(actorId)
    }
    const topology = await this.topology.getTopology(diagram.projectId)

    const siteFilter = new Set(diagram.scopeSiteIds ?? [])
    const areaFilter = new Set(diagram.scopeAreaIds ?? [])
    const hasSiteFilter = siteFilter.size > 0
    const hasAreaFilter = areaFilter.size > 0

    const inScope = (node: {
      data: { siteId: string | null; areaId: string | null }
    }) => {
      if (!hasSiteFilter && !hasAreaFilter) return true
      const siteOk = !hasSiteFilter || (node.data.siteId != null && siteFilter.has(node.data.siteId))
      const areaOk = !hasAreaFilter || (node.data.areaId != null && areaFilter.has(node.data.areaId))
      if (hasSiteFilter && hasAreaFilter) return siteOk && areaOk
      if (hasSiteFilter) return siteOk
      return areaOk
    }

    const inventory = topology.inventory.filter(inScope)
    const inventoryIds = new Set(inventory.map((n) => n.id))

    const graphNodes = topology.graph.nodes.filter((n) => inventoryIds.has(n.id))
    const allLinkEdges = await this.diagramLinks.listEdgesByProject(diagram.projectId)
    const edges = allLinkEdges.filter(
      (e) => inventoryIds.has(e.source) && inventoryIds.has(e.target)
    )

    const racks = topology.racks.filter((rack) => {
      if (!hasSiteFilter && !hasAreaFilter) return true
      const siteOk = !hasSiteFilter || (rack.siteId != null && siteFilter.has(rack.siteId))
      const areaOk = !hasAreaFilter || areaFilter.has(rack.areaId)
      if (hasSiteFilter && hasAreaFilter) return siteOk && areaOk
      if (hasSiteFilter) return siteOk
      return areaOk
    })

    const allBoards = await Board.query()
      .where('project_id', diagram.projectId)
      .whereNull('deleted_at')
      .preload('area', (a) => a.preload('site'))
      .orderBy('name', 'asc')

    const boards: TopologyBoardSummary[] = allBoards
      .map((board) => ({
        id: board.id,
        name: board.name,
        code: board.code,
        kind: board.kind,
        gridRows: board.gridRows,
        gridCols: board.gridCols,
        areaId: board.areaId,
        siteId: board.area?.siteId ?? null,
        areaName: board.area?.name ?? null,
        siteName: board.area?.site?.name ?? null,
      }))
      .filter((board) => {
        if (!hasSiteFilter && !hasAreaFilter) return true
        const siteOk = !hasSiteFilter || (board.siteId != null && siteFilter.has(board.siteId))
        const areaOk = !hasAreaFilter || areaFilter.has(board.areaId)
        if (hasSiteFilter && hasAreaFilter) return siteOk && areaOk
        if (hasSiteFilter) return siteOk
        return areaOk
      })

    const allAreas = await Area.query()
      .whereNull('deleted_at')
      .whereHas('site', (siteQuery) => {
        siteQuery.where('project_id', diagram.projectId).whereNull('deleted_at')
      })
      .preload('site')
      .orderBy('name', 'asc')

    const areas: TopologyAreaSummary[] = allAreas
      .map((area) => ({
        id: area.id,
        name: area.name,
        siteId: area.siteId,
        siteName: area.site?.name ?? null,
      }))
      .filter((area) => {
        if (!hasSiteFilter && !hasAreaFilter) return true
        const siteOk = !hasSiteFilter || siteFilter.has(area.siteId)
        const areaOk = !hasAreaFilter || areaFilter.has(area.id)
        if (hasSiteFilter && hasAreaFilter) return siteOk && areaOk
        if (hasSiteFilter) return siteOk
        return areaOk
      })

    return {
      diagram,
      graph: { nodes: graphNodes, edges },
      inventory,
      racks,
      boards,
      areas,
      summary: {
        ...topology.summary,
        deviceCount: inventory.length,
        linkCount: edges.length,
      },
    }
  }
}
