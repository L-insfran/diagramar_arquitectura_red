import vine from '@vinejs/vine'

const pointSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
})

const edgeRouteSchema = vine.object({
  points: vine.array(pointSchema.clone()),
  manual: vine.boolean().optional(),
})

const containerSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
  view: vine.enum(['front', 'rear', 'both'] as const).optional(),
  collapsed: vine.boolean().optional(),
  deviceIds: vine.array(vine.string().uuid()).optional(),
  parentId: vine.string().trim().minLength(1).maxLength(80).nullable().optional(),
  width: vine.number().min(120).optional(),
  height: vine.number().min(80).optional(),
})

const settingsSchema = vine.object({
  laneSpacing: vine.number().optional(),
  snapToGrid: vine.boolean().optional(),
  printOrientation: vine.enum(['portrait', 'landscape'] as const).optional(),
  paperSize: vine.enum(['a4', 'a3'] as const).optional(),
})

export const createConnectionDiagramValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().nullable().optional(),
    scopeSiteIds: vine.array(vine.string().uuid()).optional(),
    scopeAreaIds: vine.array(vine.string().uuid()).optional(),
    sortOrder: vine.number().optional(),
    settings: settingsSchema.clone().optional(),
  })
)

export const updateConnectionDiagramValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().nullable().optional(),
    scopeSiteIds: vine.array(vine.string().uuid()).optional(),
    scopeAreaIds: vine.array(vine.string().uuid()).optional(),
    nodePositions: vine.record(pointSchema.clone()).optional(),
    labelOffsets: vine.record(pointSchema.clone()).optional(),
    edgeRoutes: vine.record(edgeRouteSchema.clone()).optional(),
    containers: vine.record(containerSchema.clone()).optional(),
    settings: settingsSchema.clone().optional(),
    sortOrder: vine.number().optional(),
  })
)
