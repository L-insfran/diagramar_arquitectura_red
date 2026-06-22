import vine from '@vinejs/vine'

const pointSchema = vine.object({
  x: vine.number(),
  y: vine.number(),
})

export const updateTopologyCanvasLayoutValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid(),
    layer: vine.enum(['physical', 'logical'] as const),
    nodePositions: vine.record(pointSchema),
    labelOffsets: vine.record(pointSchema),
  })
)
