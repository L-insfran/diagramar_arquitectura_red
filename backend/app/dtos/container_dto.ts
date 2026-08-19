export type ContainerKind = 'default' | 'rack' | 'board'
export type BoardKind = 'electrical' | 'communications' | 'generic'

export type ContainerFilters = {
  areaId?: string
  siteId?: string
  search?: string
  kind?: ContainerKind
}

export type CreateContainerInput = {
  projectId: string
  areaId: string
  kind: ContainerKind
  name: string
  code?: string | null
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
  heightU?: number | null
  boardKind?: BoardKind | null
  gridRows?: number | null
  gridCols?: number | null
}

export type UpdateContainerInput = {
  kind?: ContainerKind
  areaId?: string
  name?: string
  code?: string | null
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
  heightU?: number | null
  boardKind?: BoardKind | null
  gridRows?: number | null
  gridCols?: number | null
}
