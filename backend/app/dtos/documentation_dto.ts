export type AttachableType =
  | 'project'
  | 'site'
  | 'area'
  | 'rack'
  | 'device'
  | 'connection'
  | 'network'
  | 'vlan'
  | 'device_template'

export const ATTACHABLE_TYPES: AttachableType[] = [
  'project',
  'site',
  'area',
  'rack',
  'device',
  'connection',
  'network',
  'vlan',
  'device_template',
]

export type AttachmentKind =
  | 'file'
  | 'pdf'
  | 'plan'
  | 'photo'
  | 'diagram'
  | 'link'
  | 'note'
  | 'other'

export type SecretKind = 'password' | 'api_key' | 'snmp' | 'wifi' | 'console' | 'other'

export type AttachmentFilters = {
  attachableType: AttachableType
  attachableId: string
}

export type CreateAttachmentInput = {
  projectId: string
  attachableType: AttachableType
  attachableId: string
  kind: AttachmentKind
  title: string
  description?: string | null
  url?: string | null
}

export type UpdateAttachmentInput = {
  title?: string
  description?: string | null
  url?: string | null
  kind?: AttachmentKind
}

export type CreateSecretInput = {
  projectId: string
  attachableType: AttachableType
  attachableId: string
  kind: SecretKind
  label: string
  username?: string | null
  value: string
  notes?: string | null
}

export type UpdateSecretInput = {
  kind?: SecretKind
  label?: string
  username?: string | null
  value?: string
  notes?: string | null
}
