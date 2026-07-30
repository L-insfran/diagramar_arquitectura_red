import vine from '@vinejs/vine'

export const createRackValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    areaId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(255),
    code: vine.string().trim().maxLength(100).optional(),
    heightU: vine.number().min(1).max(60).optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateRackValidator = vine.compile(
  vine.object({
    areaId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    code: vine.string().trim().maxLength(100).nullable().optional(),
    heightU: vine.number().min(1).max(60).optional(),
    manufacturer: vine.string().trim().maxLength(255).nullable().optional(),
    model: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)
