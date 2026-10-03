import type { ModelQueryBuilderContract } from '@adonisjs/lucid/types/model'
import Area from '#models/area'
import type Device from '#models/device'

/**
 * Site/area scope of a connection diagram.
 * Empty lists mean the diagram covers the whole project.
 */
export type InventoryScope = {
  siteIds: string[]
  areaIds: string[]
}

type AreaScopeQuery = {
  whereIn: (column: string, values: string[]) => unknown
}

export function inventoryScopeFrom(
  siteIds?: string[] | null,
  areaIds?: string[] | null
): InventoryScope {
  return {
    siteIds: uniqueIds(siteIds),
    areaIds: uniqueIds(areaIds),
  }
}

export function inventoryScopeIsOpen(scope: InventoryScope): boolean {
  return scope.siteIds.length === 0 && scope.areaIds.length === 0
}

/**
 * Devices match the diagram rule: site is `site_id`, or the area's site when
 * `site_id` is empty. Both filters apply together when both are set.
 */
export function applyDeviceLocationScope(
  query: ModelQueryBuilderContract<typeof Device>,
  scope: InventoryScope
) {
  if (scope.areaIds.length > 0) {
    query.whereIn('area_id', scope.areaIds)
  }
  if (scope.siteIds.length === 0) return

  const siteIds = scope.siteIds
  query.where((nested) => {
    nested.whereIn('site_id', siteIds).orWhere((fallback) => {
      fallback.whereNull('site_id').whereIn(
        'area_id',
        Area.query().select('id').whereIn('site_id', siteIds)
      )
    })
  })
}

export function applyAreaLocationScope(query: AreaScopeQuery, scope: InventoryScope) {
  if (scope.areaIds.length > 0) query.whereIn('id', scope.areaIds)
  if (scope.siteIds.length > 0) query.whereIn('site_id', scope.siteIds)
}

function uniqueIds(ids?: string[] | null): string[] {
  return [...new Set((ids ?? []).filter((id) => typeof id === 'string' && id.length > 0))]
}
