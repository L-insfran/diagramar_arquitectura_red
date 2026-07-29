import vine from '@vinejs/vine'

const pointSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
})

/** Offsets de etiqueta + curvatura de cable (bendX/bendY opcionales). */
const labelOffsetSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
  bendX: vine.number().optional(),
  bendY: vine.number().optional(),
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
    labelOffsets: vine.record(labelOffsetSchema),
    workAreas: vine.array(workAreaSchema).optional(),
    nodeParents: vine.record(vine.string().trim().minLength(1)).optional(),
  })
)
