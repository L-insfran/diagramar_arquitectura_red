import { DateTime } from 'luxon'
import ConnectionDiagram from '#models/connection_diagram'
import Container from '#models/container'
import Area from '#models/area'
import type {
  CreateConnectionDiagramInput,
  DiagramContainerState,
  UpdateConnectionDiagramInput,
} from '#dtos/connection_diagram_dto'

export type DiagramDevicePlacement = {
  diagramId: string
  diagramName: string
  containerKey: string
  areaId: string | null
  areaName: string | null
  containerLabel: string
}

function parseContainerFlowKey(key: string): { kind: 'area' | 'container'; id: string } | null {
  if (key.startsWith('area:')) return { kind: 'area', id: key.slice(5) }
  if (key.startsWith('container:')) return { kind: 'container', id: key.slice(10) }
  if (key.startsWith('rack:')) return { kind: 'container', id: key.slice(5) }
  if (key.startsWith('board:')) return { kind: 'container', id: key.slice(6) }
  return null
}

export default class ConnectionDiagramRepository {
  async findAllByProject(projectId: string) {
    return ConnectionDiagram.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .orderBy('sort_order', 'asc')
      .orderBy('name', 'asc')
  }

  async findByIdOrFail(id: string) {
    return ConnectionDiagram.query()
      .where('id', id)
      .whereNull('deleted_at')
      .firstOrFail()
  }

  async findActiveInProject(id: string, projectId: string) {
    return ConnectionDiagram.query()
      .where('id', id)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .first()
  }

  async create(data: CreateConnectionDiagramInput & { createdBy: string; updatedBy: string }) {
    return ConnectionDiagram.create({
      projectId: data.projectId,
      name: data.name,
      description: data.description ?? null,
      scopeSiteIds: data.scopeSiteIds ?? [],
      scopeAreaIds: data.scopeAreaIds ?? [],
      nodePositions: {},
      labelOffsets: {},
      edgeRoutes: {},
      containers: {},
      handleAnchors: {},
      treeLayout: {},
      layoutMode: data.layoutMode ?? 'free',
      settings: data.settings ?? {},
      sortOrder: data.sortOrder ?? 0,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(
    diagram: ConnectionDiagram,
    data: UpdateConnectionDiagramInput & { updatedBy: string }
  ) {
    diagram.merge(data)
    await diagram.save()
    return diagram
  }

  async softDelete(diagram: ConnectionDiagram, deletedBy: string) {
    diagram.deletedAt = DateTime.now()
    diagram.deletedBy = deletedBy
    diagram.updatedBy = deletedBy
    await diagram.save()
  }

  async findByNameInProject(projectId: string, name: string, excludeId?: string) {
    const query = ConnectionDiagram.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .whereRaw('lower(name) = lower(?)', [name])
    if (excludeId) {
      query.whereNot('id', excludeId)
    }
    return query.first()
  }

  /** Diagram containers where `deviceId` appears in saved deviceIds. */
  async findPlacementsForDevice(
    projectId: string,
    deviceId: string,
  ): Promise<DiagramDevicePlacement[]> {
    const diagrams = await this.findAllByProject(projectId)
    const hits: Array<{
      diagram: ConnectionDiagram
      containerKey: string
      parsed: { kind: 'area' | 'container'; id: string }
    }> = []

    for (const diagram of diagrams) {
      const containers = diagram.containers ?? {}
      for (const [containerKey, state] of Object.entries(containers)) {
        const saved = state as DiagramContainerState
        if (!saved.deviceIds?.includes(deviceId)) continue
        const parsed = parseContainerFlowKey(containerKey)
        if (!parsed) continue
        hits.push({ diagram, containerKey, parsed })
      }
    }

    if (hits.length === 0) return []

    const areaIds = new Set<string>()
    const containerIds = new Set<string>()
    for (const hit of hits) {
      if (hit.parsed.kind === 'area') areaIds.add(hit.parsed.id)
      else containerIds.add(hit.parsed.id)
    }

    const areas =
      areaIds.size > 0
        ? await Area.query().whereIn('id', [...areaIds]).whereNull('deleted_at')
        : []
    const areaById = new Map(areas.map((a) => [a.id, a]))

    const containers =
      containerIds.size > 0
        ? await Container.query()
            .whereIn('id', [...containerIds])
            .whereNull('deleted_at')
            .preload('area')
        : []
    const containerById = new Map(containers.map((c) => [c.id, c]))

    return hits.map(({ diagram, containerKey, parsed }) => {
      if (parsed.kind === 'area') {
        const area = areaById.get(parsed.id)
        return {
          diagramId: diagram.id,
          diagramName: diagram.name,
          containerKey,
          areaId: parsed.id,
          areaName: area?.name ?? null,
          containerLabel: area?.name ?? 'Área',
        }
      }

      const container = containerById.get(parsed.id)
      return {
        diagramId: diagram.id,
        diagramName: diagram.name,
        containerKey,
        areaId: container?.areaId ?? null,
        areaName: container?.area?.name ?? null,
        containerLabel: container?.name ?? 'Contenedor',
      }
    })
  }
}
