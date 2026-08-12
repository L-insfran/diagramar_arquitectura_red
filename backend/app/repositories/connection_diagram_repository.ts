import { DateTime } from 'luxon'
import ConnectionDiagram from '#models/connection_diagram'
import type {
  CreateConnectionDiagramInput,
  UpdateConnectionDiagramInput,
} from '#dtos/connection_diagram_dto'

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
}
