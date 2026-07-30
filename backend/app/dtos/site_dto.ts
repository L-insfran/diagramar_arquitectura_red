export type SiteFilters = {
  search?: string
}

export type CreateSiteInput = {
  projectId: string
  name: string
  address?: string | null
  notes?: string | null
}

export type UpdateSiteInput = {
  name?: string
  address?: string | null
  notes?: string | null
}

export type CreateAreaInput = {
  siteId: string
  name: string
  notes?: string | null
}

export type UpdateAreaInput = {
  name?: string
  notes?: string | null
  siteId?: string
}
