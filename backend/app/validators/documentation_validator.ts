import vine from '@vinejs/vine'

const attachableType = vine.enum([
  'project',
  'site',
  'area',
  'rack',
  'device',
  'connection',
  'network',
  'vlan',
  'device_template',
] as const)

const attachmentKind = vine.enum([
  'file',
  'pdf',
  'plan',
  'photo',
  'diagram',
  'link',
  'note',
  'other',
] as const)

const secretKind = vine.enum([
  'password',
  'api_key',
  'snmp',
  'wifi',
  'console',
  'other',
] as const)

export const createAttachmentValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    attachableType: attachableType,
    attachableId: vine.string().uuid(),
    kind: attachmentKind,
    title: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().maxLength(5000).optional(),
    url: vine.string().trim().maxLength(2000).optional(),
  })
)

export const updateAttachmentValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().maxLength(5000).nullable().optional(),
    url: vine.string().trim().maxLength(2000).nullable().optional(),
    kind: attachmentKind.optional(),
  })
)

export const createSecretValidator = vine.compile(
  vine.object({
    projectId: vine.string().uuid(),
    attachableType: attachableType,
    attachableId: vine.string().uuid(),
    kind: secretKind,
    label: vine.string().trim().minLength(1).maxLength(255),
    username: vine.string().trim().maxLength(255).optional(),
    value: vine.string().minLength(1).maxLength(10000),
    notes: vine.string().trim().maxLength(5000).optional(),
  })
)

export const updateSecretValidator = vine.compile(
  vine.object({
    kind: secretKind.optional(),
    label: vine.string().trim().minLength(1).maxLength(255).optional(),
    username: vine.string().trim().maxLength(255).nullable().optional(),
    value: vine.string().minLength(1).maxLength(10000).optional(),
    notes: vine.string().trim().maxLength(5000).nullable().optional(),
  })
)
