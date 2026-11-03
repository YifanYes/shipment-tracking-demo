import type { LogisticsLocation, ShipmentLeg, ShipmentView } from '@/domain/contracts'
import { attentionReasons } from '@/domain/attention'
import type { FeatureCollection, LineString, Point, Position } from 'geojson'

export type MapTone = 'transit' | 'attention' | 'delivered' | 'unknown'
export type LegState = 'completed' | 'active' | 'pending'
export interface RouteProperties {
  shipmentId: string
  legId: string
  mode: ShipmentLeg['mode']
  state: LegState
  tone: MapTone
  selected: boolean
  muted: boolean
}
export interface PointProperties {
  shipmentId: string
  attention: 0 | 1
}
export type MapBounds = [[west: number, south: number], [east: number, north: number]]

type Coordinates = readonly [longitude: number, latitude: number]

function validCoordinates(coordinates: readonly number[] | undefined): coordinates is Coordinates {
  return (
    !!coordinates &&
    coordinates.length === 2 &&
    Number.isFinite(coordinates[0]) &&
    Math.abs(coordinates[0]!) <= 180 &&
    Number.isFinite(coordinates[1]) &&
    Math.abs(coordinates[1]!) <= 90
  )
}

export function hasCoordinates(
  location: LogisticsLocation | undefined,
): location is LogisticsLocation & { coordinates: Coordinates } {
  return validCoordinates(location?.coordinates)
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

export function sortedLegs(item: ShipmentView) {
  return [...item.shipment.legs].sort((a, b) => a.sequence - b.sequence)
}

export function currentLeg(item: ShipmentView) {
  return item.shipment.legs.find((leg) => leg.id === item.projection.currentLegId)
}

/** Completed legs come from the projection; only an active shipment has an active leg. */
export function legState(item: ShipmentView, leg: ShipmentLeg): LegState {
  if (item.projection.legStages[leg.id] === 'completed') return 'completed'
  if (item.projection.lifecycle === 'active' && leg.id === item.projection.currentLegId)
    return 'active'
  return 'pending'
}

/** A supplied itinerary with at least three valid points; endpoints alone are never a route. */
export function legRoute(leg: ShipmentLeg): Position[] | null {
  const coordinates = leg.route?.coordinates
  if (!coordinates || coordinates.length < 3 || !coordinates.every(validCoordinates)) return null
  return coordinates.map((point) => [...point])
}

/**
 * One feature per leg with real geometry. Active shipments are always drawn; a planned one only
 * while selected. With a selection, every other route is muted.
 */
export function mapRoutes(
  shipments: readonly ShipmentView[],
  cutoffAt: string,
  selectedId?: string | null,
): FeatureCollection<LineString, RouteProperties> {
  return {
    type: 'FeatureCollection',
    features: shipments
      .filter(
        (item) =>
          item.projection.lifecycle === 'active' ||
          (item.projection.lifecycle === 'planned' && item.shipment.id === selectedId),
      )
      .flatMap((item) => {
        const tone = mapTone(item, cutoffAt)
        const selected = item.shipment.id === selectedId
        return sortedLegs(item).flatMap((leg) => {
          const coordinates = legRoute(leg)
          if (!coordinates) return []
          return [
            {
              type: 'Feature' as const,
              properties: {
                shipmentId: item.shipment.id,
                legId: leg.id,
                mode: leg.mode,
                state: legState(item, leg),
                tone,
                selected,
                muted: !!selectedId && !selected,
              },
              geometry: { type: 'LineString' as const, coordinates },
            },
          ]
        })
      }),
  }
}

/** Shipment markers at the last confirmed location; no position is interpolated. */
export function mapPoints(
  shipments: readonly ShipmentView[],
  cutoffAt: string,
): FeatureCollection<Point, PointProperties> {
  return {
    type: 'FeatureCollection',
    features: shipments.flatMap((item) => {
      const location = confirmedLocation(item)
      if (!hasCoordinates(location)) return []
      return [
        {
          type: 'Feature' as const,
          properties: {
            shipmentId: item.shipment.id,
            attention: attentionReasons(item, cutoffAt).length ? (1 as const) : (0 as const),
          },
          geometry: { type: 'Point' as const, coordinates: [...location.coordinates] },
        },
      ]
    }),
  }
}

/**
 * Bounds of every drawable route (all legs, sea included), confirmed location and network site of
 * the given shipments. `null` when nothing has coordinates.
 */
export function mapBounds(
  shipments: readonly ShipmentView[],
  cutoffAt: string,
  selectedId?: string | null,
  extra: readonly Coordinates[] = [],
): MapBounds | null {
  const points: Position[] = [...extra.map((point) => [...point])]
  mapRoutes(shipments, cutoffAt, selectedId).features.forEach((feature) =>
    points.push(...feature.geometry.coordinates),
  )
  shipments.forEach((item) => {
    const location = confirmedLocation(item)
    if (hasCoordinates(location)) points.push([...location.coordinates])
  })
  if (!points.length) return null
  let [west, south, east, north] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [longitude, latitude] of points) {
    west = Math.min(west, longitude!)
    east = Math.max(east, longitude!)
    south = Math.min(south, latitude!)
    north = Math.max(north, latitude!)
  }
  return [
    [west, south],
    [east, north],
  ]
}
