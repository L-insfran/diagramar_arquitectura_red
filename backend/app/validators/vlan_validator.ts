import vine from '@vinejs/vine'

export const createVlanValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid(),
    vlanId: vine.number().range([1, 4094]).withoutDecimals(),
    name: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
  })
)

export const updateVlanValidator = vine.compile(
  vine.object({
    companyId: vine.string().uuid().optional(),
    vlanId: vine.number().range([1, 4094]).withoutDecimals().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
  })
)
