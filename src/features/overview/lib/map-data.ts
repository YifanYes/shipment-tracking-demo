import type { LogisticsLocation, ShipmentView } from '@/domain/contracts'
import { attentionReasons } from '@/domain/attention'
import type { FeatureCollection, LineString } from 'geojson'

export type MapTone = 'transit' | 'attention' | 'delivered' | 'unknown'

export function hasCoordinates(
  location: LogisticsLocation | undefined,
): location is LogisticsLocation & { coordinates: readonly [number, number] } {
  const coordinates = location?.coordinates
  return (
    !!coordinates &&
    coordinates.length === 2 &&
    Number.isFinite(coordinates[0]) &&
    Math.abs(coordinates[0]) <= 180 &&
    Number.isFinite(coordinates[1]) &&
    Math.abs(coordinates[1]) <= 90
  )
}

export function confirmedLocation(item: ShipmentView) {
  return item.locations.find(
    (location) => location.id === item.projection.lastConfirmedLocation?.locationId,
  )
}

export function mapTone(item: ShipmentView, cutoffAt: string): MapTone {
  if (attentionReasons(item, cutoffAt).length) return 'attention'
  if (item.projection.lifecycle === 'delivered') return 'delivered'
  if (item.projection.lifecycle === 'planned') return 'unknown'
  return 'transit'
}

export function mapRoutes(
  shipments: readonly ShipmentView[],
  cutoffAt: string,
  selectedId?: string,
): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: shipments
      .filter((item) => item.projection.lifecycle === 'active')
      .flatMap((item) =>
        item.shipment.legs.flatMap((leg) => {
          const coordinates = leg.route?.coordinates
          if (
            !coordinates ||
            coordinates.length < 3 ||
            !coordinates.every(
              ([longitude, latitude]) =>
                Number.isFinite(longitude) &&
                Math.abs(longitude) <= 180 &&
                Number.isFinite(latitude) &&
                Math.abs(latitude) <= 90,
            )
          )
            return []
          return [
            {
              type: 'Feature' as const,
              properties: {
                shipmentId: item.shipment.id,
                legId: leg.id,
                mode: leg.mode,
                tone: mapTone(item, cutoffAt),
                selected: item.shipment.id === selectedId,
              },
              geometry: {
                type: 'LineString' as const,
                coordinates: coordinates.map((point) => [...point]),
              },
            },
          ]
        }),
      ),
  }
}
