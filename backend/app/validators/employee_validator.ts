import vine from '@vinejs/vine'

export const createEmployeeValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid(),
    departmentId: vine.string().uuid().optional(),
    firstName: vine.string().trim().minLength(1).maxLength(100),
    lastName: vine.string().trim().minLength(1).maxLength(100),
    email: vine.string().trim().email().optional(),
    phone: vine.string().trim().maxLength(50).optional(),
    position: vine.string().trim().maxLength(255).optional(),
  })
)

export const updateEmployeeValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid().optional(),
    departmentId: vine.string().uuid().optional().nullable(),
    firstName: vine.string().trim().minLength(1).maxLength(100).optional(),
    lastName: vine.string().trim().minLength(1).maxLength(100).optional(),
    email: vine.string().trim().email().optional().nullable(),
    phone: vine.string().trim().maxLength(50).optional().nullable(),
    position: vine.string().trim().maxLength(255).optional().nullable(),
  })
)
