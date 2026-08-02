import vine from '@vinejs/vine'

const heightU = vine.number().withoutDecimals().in([1, 2])
const mountType = vine.enum(['front_only', 'four_post'] as const)
const kind = vine.enum(['shelf'] as const)

export const createRackAccessoryTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    kind: kind.optional(),
    heightU,
    defaultMountType: mountType.optional(),
    manufacturer: vine.string().trim().maxLength(255).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateRackAccessoryTemplateValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    heightU: heightU.optional(),
    defaultMountType: mountType.optional(),
    manufacturer: vine.string().trim().maxLength(255).nullable().optional(),
    model: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)

export const createRackAccessoryValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    rackId: vine.string().uuid(),
    accessoryTemplateId: vine.string().uuid().nullable().optional(),
    name: vine.string().trim().minLength(1).maxLength(255),
    kind: kind.optional(),
    unitStart: vine.number().min(1).max(60),
    heightU,
    mountType,
    manufacturer: vine.string().trim().maxLength(255).optional(),
    model: vine.string().trim().maxLength(255).optional(),
    notes: vine.string().trim().optional(),
  })
)

export const updateRackAccessoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    unitStart: vine.number().min(1).max(60).optional(),
    heightU: heightU.optional(),
    mountType: mountType.optional(),
    manufacturer: vine.string().trim().maxLength(255).nullable().optional(),
    model: vine.string().trim().maxLength(255).nullable().optional(),
    notes: vine.string().trim().nullable().optional(),
  })
)
