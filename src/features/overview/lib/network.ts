import type { EntityId, LogisticsLocation, ShipmentView } from '@/domain/contracts'
import { hasCoordinates } from './map-data'

export type SiteKind = 'site' | 'port' | 'destination'

export interface MapSite {
  id: EntityId
  name: string
  placeLabel: string
  kind: SiteKind
  coordinates: readonly [longitude: number, latitude: number]
  shipmentIds: readonly EntityId[]
}

export const siteKindLabels: Record<SiteKind, string> = {
  site: 'Centro',
  port: 'Puerto',
  destination: 'Destino',
}

function siteKind(location: LogisticsLocation): SiteKind | null {
  if (location.kind === 'factory' || location.kind === 'warehouse') return 'site'
  if (location.kind === 'port' || location.kind === 'destination') return location.kind
  return null
}

/** Origin, leg endpoints, final destination and current location of a shipment. */
export function shipmentSiteIds(item: ShipmentView): Set<EntityId> {
  const ids = new Set<EntityId>([item.shipment.originSiteId, item.shipment.destinationLocationId])
  item.shipment.legs.forEach((leg) => {
    ids.add(leg.originLocationId)
    ids.add(leg.destinationLocationId)
  })
  const current = item.projection.lastConfirmedLocation?.locationId
  if (current) ids.add(current)
  return ids
}

/**
 * Centers, ports and destinations referenced by the given (already scoped) shipments. Waypoints
 * and locations without valid coordinates are not network sites.
 */
export function networkSites(shipments: readonly ShipmentView[]): MapSite[] {
  const sites = new Map<EntityId, { location: LogisticsLocation; shipmentIds: EntityId[] }>()
  for (const item of shipments) {
    for (const id of shipmentSiteIds(item)) {
      const location =
        item.locations.find((entry) => entry.id === id) ??
        [item.origin, item.destination].find((entry) => entry?.id === id)
      if (!location || !siteKind(location) || !hasCoordinates(location)) continue
      const entry = sites.get(id) ?? { location, shipmentIds: [] }
      entry.shipmentIds.push(item.shipment.id)
      sites.set(id, entry)
    }
  }
  const order: SiteKind[] = ['site', 'port', 'destination']
  return [...sites.values()]
    .map(({ location, shipmentIds }) => ({
      id: location.id,
      name: location.name,
      placeLabel: location.placeLabel,
      kind: siteKind(location)!,
      coordinates: location.coordinates!,
      shipmentIds,
    }))
    .sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind) || a.name.localeCompare(b.name))
}

export function shipmentsAtSite(shipments: readonly ShipmentView[], siteId: EntityId) {
  return shipments.filter((item) => shipmentSiteIds(item).has(siteId))
}
