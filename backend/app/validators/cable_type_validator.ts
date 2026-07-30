import vine from '@vinejs/vine'

const mediumFamily = vine.enum([
  'utp',
  'fiber',
  'wifi',
  'internet',
  'power',
  'console',
  'other',
] as const)

export const createCableTypeValidator = vine.compile(
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
    mediumFamily: mediumFamily,
    defaultCategory: vine.string().trim().maxLength(10).optional(),
    defaultFiberType: vine.string().trim().maxLength(20).optional(),
    color: vine.string().trim().maxLength(20).optional(),
    sortOrder: vine.number().min(0).max(9999).optional(),
  })
)

export const updateCableTypeValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(100).optional(),
    description: vine.string().trim().nullable().optional(),
    mediumFamily: mediumFamily.optional(),
    defaultCategory: vine.string().trim().maxLength(10).nullable().optional(),
    defaultFiberType: vine.string().trim().maxLength(20).nullable().optional(),
    color: vine.string().trim().maxLength(20).nullable().optional(),
    sortOrder: vine.number().min(0).max(9999).optional(),
  })
)
