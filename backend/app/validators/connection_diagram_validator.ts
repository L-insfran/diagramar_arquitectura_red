import vine from '@vinejs/vine'

const pointSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
})

const labelOffsetSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
  t: vine.number().min(0).max(1).optional(),
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
  contentMinWidth: vine.number().min(0).optional(),
  contentMinHeight: vine.number().min(0).optional(),
})

const printFrameSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
  cols: vine.number().min(1).max(24),
  rows: vine.number().min(1).max(24),
  mmPerPx: vine.number().min(0.02).max(0.4),
})

const settingsSchema = vine.object({
  deviceGap: vine.number().min(8).max(72).optional(),
  laneSpacing: vine.number().optional(),
  snapToGrid: vine.boolean().optional(),
  printOrientation: vine.enum(['portrait', 'landscape'] as const).optional(),
  paperSize: vine.enum(['a4', 'a3'] as const).optional(),
  printFrame: printFrameSchema.clone().optional(),
  printIncludeLegend: vine.boolean().optional(),
  printIncludeLinkTable: vine.boolean().optional(),
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
    labelOffsets: vine.record(labelOffsetSchema.clone()).optional(),
    edgeRoutes: vine.record(edgeRouteSchema.clone()).optional(),
    containers: vine.record(containerSchema.clone()).optional(),
    settings: settingsSchema.clone().optional(),
    sortOrder: vine.number().optional(),
  })
)
