import vine from '@vinejs/vine'

const pointSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
})

const workAreaSchema = vine.object({
  id: vine.string().trim().minLength(1),
  name: vine.string().trim().minLength(1).maxLength(120),
  x: vine.number(),
  y: vine.number(),
  width: vine.number().min(40),
  height: vine.number().min(40),
  titleFontSize: vine.number().min(12).max(120).optional(),
})

export const updateTopologyCanvasLayoutValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid(),
    layer: vine.enum(['unified'] as const).optional(),
    nodePositions: vine.record(pointSchema),
    labelOffsets: vine.record(pointSchema),
    workAreas: vine.array(workAreaSchema).optional(),
    nodeParents: vine.record(vine.string().trim().minLength(1)).optional(),
  })
)
