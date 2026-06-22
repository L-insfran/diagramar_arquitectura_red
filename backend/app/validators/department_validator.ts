import vine from '@vinejs/vine'

export const createDepartmentValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid(),
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
  })
)

export const updateDepartmentValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
  })
)
