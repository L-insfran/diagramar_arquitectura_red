import vine from '@vinejs/vine'

const portDirection = vine.enum(['in', 'out', 'bidirectional'] as const)

export const createPortTypeValidator = vine.compile(
  vine.object({
    code: vine
      .string()
      .trim()
      .toLowerCase()
      .minLength(1)
      .maxLength(50)
      .regex(/^[a-z][a-z0-9_-]*$/),
    name: vine.string().trim().minLength(1).maxLength(100),
    description: vine.string().trim().optional(),
    defaultSpeed: vine.string().trim().maxLength(50).optional(),
    color: vine.string().trim().maxLength(20).optional(),
    icon: vine.string().trim().maxLength(50).optional(),
    direction: portDirection.optional(),
  })
)

export const updatePortTypeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100).optional(),
    description: vine.string().trim().optional().nullable(),
    defaultSpeed: vine.string().trim().maxLength(50).nullable().optional(),
    color: vine.string().trim().maxLength(20).nullable().optional(),
    icon: vine.string().trim().maxLength(50).nullable().optional(),
    direction: portDirection.optional(),
  })
)
