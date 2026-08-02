export type AccessoryKind = 'shelf'
export type ShelfMountType = 'front_only' | 'four_post'
export type RackFace = 'front' | 'rear'

export type CreateRackAccessoryTemplateInput = {
  name: string
  kind?: AccessoryKind
  heightU: 1 | 2
  defaultMountType?: ShelfMountType
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type UpdateRackAccessoryTemplateInput = {
  name?: string
  heightU?: 1 | 2
  defaultMountType?: ShelfMountType
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type RackAccessoryFilters = {
  rackId?: string
  kind?: AccessoryKind
  search?: string
}

export type CreateRackAccessoryInput = {
  projectId: string
  rackId: string
  accessoryTemplateId?: string | null
  name: string
  kind?: AccessoryKind
  unitStart: number
  heightU: 1 | 2
  mountType: ShelfMountType
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type UpdateRackAccessoryInput = {
  name?: string
  unitStart?: number
  heightU?: 1 | 2
  mountType?: ShelfMountType
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

/** Faces blocked by a shelf according to mount type. */
export function facesForMountType(mountType: ShelfMountType): RackFace[] {
  return mountType === 'four_post' ? ['front', 'rear'] : ['front']
}
