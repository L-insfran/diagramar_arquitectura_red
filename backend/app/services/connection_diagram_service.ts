import { Exception } from '@adonisjs/core/exceptions'
import ConnectionDiagramRepository from '#repositories/connection_diagram_repository'
import TopologyService from '#services/topology_service'
import DiagramLinkService from '#services/diagram_link_service'
import Area from '#models/area'
import type {
  CreateConnectionDiagramInput,
  DiagramContainerState,
  DiagramEdgeRoute,
  DiagramHandleAnchor,
  DiagramLayoutState,
  DiagramPoint,
  UpdateConnectionDiagramInput,
} from '#dtos/connection_diagram_dto'

type TopologyAreaSummary = {
  id: string
  name: string
  siteId: string
  siteName: string | null
}

/**
 * Remove a device (and optional link ids) from a layout geometry bucket.
 * Returns whether anything changed and the pruned state.
 */
function pruneDeviceFromLayoutState(
  state: DiagramLayoutState | null | undefined,
  deviceId: string,
  linkIds: Set<string> = new Set(),
  options: {
    clearNodePosition?: boolean
    clearHandleAnchors?: boolean
  } = {},
): { changed: boolean; state: DiagramLayoutState } {
  const clearNodePosition = options.clearNodePosition !== false
  const clearHandleAnchors = options.clearHandleAnchors !== false
  const nodePositions: Record<string, DiagramPoint> = {
    ...(state?.nodePositions ?? {}),
  }
  const handleAnchors: Record<string, DiagramHandleAnchor> = {
    ...(state?.handleAnchors ?? {}),
  }
  const edgeRoutes: Record<string, DiagramEdgeRoute> = {
    ...(state?.edgeRoutes ?? {}),
  }
  const labelOffsets: Record<string, DiagramPoint> = {
    ...(state?.labelOffsets ?? {}),
  }
  let changed = false

  if (clearNodePosition && nodePositions[deviceId]) {
    delete nodePositions[deviceId]
    changed = true
  }

  if (clearHandleAnchors) {
    for (const key of Object.keys(handleAnchors)) {
      if (key.startsWith(`${deviceId}::`)) {
        delete handleAnchors[key]
        changed = true
      }
    }
  }

  if (linkIds.size > 0) {
    for (const linkId of linkIds) {
      if (edgeRoutes[linkId]) {
        delete edgeRoutes[linkId]
        changed = true
      }
      if (labelOffsets[linkId]) {
        delete labelOffsets[linkId]
        changed = true
      }
    }
  }

  return {
    changed,
    state: { nodePositions, handleAnchors, edgeRoutes, labelOffsets },
  }
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
      layoutMode: source.layoutMode ?? 'free',
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
      handleAnchors: { ...(source.handleAnchors ?? {}) },
      treeLayout: {
        nodePositions: { ...(source.treeLayout?.nodePositions ?? {}) },
        labelOffsets: { ...(source.treeLayout?.labelOffsets ?? {}) },
        edgeRoutes: { ...(source.treeLayout?.edgeRoutes ?? {}) },
        handleAnchors: { ...(source.treeLayout?.handleAnchors ?? {}) },
      },
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

    const containers = topology.containers.filter((c) => {
      if (!hasSiteFilter && !hasAreaFilter) return true
      const siteOk = !hasSiteFilter || (c.siteId != null && siteFilter.has(c.siteId))
      const areaOk = !hasAreaFilter || areaFilter.has(c.areaId)
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
      containers,
      areas,
      summary: {
        ...topology.summary,
        deviceCount: inventory.length,
        linkCount: edges.length,
      },
    }
  }

  /**
   * Candidate flow keys for a physical container / area in diagram `containers` JSON.
   * Prefer kind-specific prefixes; include legacy `container:` and `rack:`/`board:`.
   */
  private resolveTargetFlowKeys(target: {
    containerId: string | null
    areaId: string | null
    containerKind?: 'default' | 'rack' | 'board' | null
  }): string[] {
    const { containerId, areaId, containerKind } = target
    if (containerId && containerKind === 'board') {
      return [`board:${containerId}`, `container:${containerId}`]
    }
    if (containerId && containerKind === 'rack') {
      return [`rack:${containerId}`, `container:${containerId}`]
    }
    // Default container (or no container): devices appear loose under the area node.
    if (areaId) {
      return [`area:${areaId}`]
    }
    return []
  }

  /**
   * Move a device's visual membership to match inventory location across all diagrams.
   * Removes from every `deviceIds` list; if the destination flow key exists on a diagram,
   * appends there. Clears saved node position so the canvas restacks under the new parent.
   * Does not touch diagram_links.
   */
  async reparentDeviceInDiagrams(
    projectId: string,
    deviceId: string,
    target: {
      containerId: string | null
      areaId: string | null
      containerKind?: 'default' | 'rack' | 'board' | null
    },
    actorId: string,
  ) {
    const diagrams = await this.diagrams.findAllByProject(projectId)
    const targetKeys = this.resolveTargetFlowKeys(target)
    const modifiedDiagramIds: string[] = []

    for (const diagram of diagrams) {
      let changed = false
      const containers: Record<string, DiagramContainerState> = {}

      for (const [key, state] of Object.entries(diagram.containers ?? {})) {
        if (!state.deviceIds?.includes(deviceId)) {
          containers[key] = state
          continue
        }
        changed = true
        containers[key] = {
          ...state,
          deviceIds: state.deviceIds.filter((id) => id !== deviceId),
        }
      }

      for (const targetKey of targetKeys) {
        const dest = containers[targetKey]
        if (!dest) continue
        const ids = dest.deviceIds ?? []
        if (!ids.includes(deviceId)) {
          containers[targetKey] = { ...dest, deviceIds: [...ids, deviceId] }
          changed = true
        }
        break
      }

      const freePruned = pruneDeviceFromLayoutState(
        {
          nodePositions: diagram.nodePositions,
          labelOffsets: diagram.labelOffsets,
          edgeRoutes: diagram.edgeRoutes,
          handleAnchors: diagram.handleAnchors,
        },
        deviceId,
        new Set(),
        { clearNodePosition: true, clearHandleAnchors: false },
      )
      const treePruned = pruneDeviceFromLayoutState(
        diagram.treeLayout,
        deviceId,
        new Set(),
        { clearNodePosition: true, clearHandleAnchors: false },
      )
      if (freePruned.changed || treePruned.changed) changed = true

      if (!changed) continue

      await this.diagrams.update(diagram, {
        containers,
        nodePositions: freePruned.state.nodePositions ?? {},
        treeLayout: {
          ...(diagram.treeLayout ?? {}),
          nodePositions: treePruned.state.nodePositions ?? {},
        },
        updatedBy: actorId,
      })
      modifiedDiagramIds.push(diagram.id)
    }

    return modifiedDiagramIds
  }

  /**
   * Remove a device from every connection diagram in the project (layout JSON only).
   * Optionally prune edgeRoutes/labelOffsets for deleted link ids.
   */
  async removeDeviceFromAllDiagrams(
    projectId: string,
    deviceId: string,
    actorId: string,
    linkIdsToPrune: string[] = [],
  ) {
    const diagrams = await this.diagrams.findAllByProject(projectId)
    const linkIdSet = new Set(linkIdsToPrune)
    const modifiedDiagramIds: string[] = []

    for (const diagram of diagrams) {
      let changed = false

      const containers: Record<string, DiagramContainerState> = {}
      for (const [key, state] of Object.entries(diagram.containers ?? {})) {
        const deviceIds = state.deviceIds?.filter((id) => id !== deviceId)
        if (deviceIds?.length !== state.deviceIds?.length) {
          changed = true
          containers[key] = { ...state, deviceIds: deviceIds ?? [] }
        } else {
          containers[key] = state
        }
      }

      const freePruned = pruneDeviceFromLayoutState(
        {
          nodePositions: diagram.nodePositions,
          labelOffsets: diagram.labelOffsets,
          edgeRoutes: diagram.edgeRoutes,
          handleAnchors: diagram.handleAnchors,
        },
        deviceId,
        linkIdSet,
      )
      const treePruned = pruneDeviceFromLayoutState(diagram.treeLayout, deviceId, linkIdSet)
      if (freePruned.changed || treePruned.changed) changed = true

      if (!changed) continue

      await this.diagrams.update(diagram, {
        containers,
        nodePositions: freePruned.state.nodePositions ?? {},
        handleAnchors: freePruned.state.handleAnchors ?? {},
        edgeRoutes: freePruned.state.edgeRoutes ?? {},
        labelOffsets: freePruned.state.labelOffsets ?? {},
        treeLayout: treePruned.state,
        updatedBy: actorId,
      })
      modifiedDiagramIds.push(diagram.id)
    }

    return modifiedDiagramIds
  }
}
