import vine from '@vinejs/vine'

const userRole = vine.enum(['admin', 'operator', 'viewer'] as const)

export const createSystemUserValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid(),
    email: vine.string().trim().email(),
    password: vine.string().minLength(8).maxLength(128),
    firstName: vine.string().trim().minLength(1).maxLength(100),
    lastName: vine.string().trim().minLength(1).maxLength(100),
    role: userRole,
    isActive: vine.boolean().optional(),
  })
)

export const updateSystemUserValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().optional(),
    password: vine.string().minLength(8).maxLength(128).optional(),
    firstName: vine.string().trim().minLength(1).maxLength(100).optional(),
    lastName: vine.string().trim().minLength(1).maxLength(100).optional(),
    role: userRole.optional(),
    isActive: vine.boolean().optional(),
  })
)
