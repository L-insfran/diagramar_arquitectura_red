import vine from '@vinejs/vine'

export const createNetworkValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    vlanId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255),
    subnet: vine.string().trim().minLength(1).maxLength(100),
    gateway: vine.string().trim().maxLength(45).optional(),
    dnsPrimary: vine.string().trim().maxLength(45).optional(),
    dnsSecondary: vine.string().trim().maxLength(45).optional(),
    dhcpEnabled: vine.boolean().optional(),
    description: vine.string().trim().optional(),
  })
)

export const updateNetworkValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid().optional(),
    vlanId: vine.string().uuid().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    subnet: vine.string().trim().minLength(1).maxLength(100).optional(),
    gateway: vine.string().trim().maxLength(45).optional(),
    dnsPrimary: vine.string().trim().maxLength(45).optional(),
    dnsSecondary: vine.string().trim().maxLength(45).optional(),
    dhcpEnabled: vine.boolean().optional(),
    description: vine.string().trim().optional(),
  })
)
