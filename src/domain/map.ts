import type { LogisticsLocation, ShipmentView } from './contracts'
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

export function attentionReasons(item: ShipmentView, cutoffAt: string): string[] {
  const { projection, shipment } = item
  const reasons: string[] = []
  if (projection.incidentIds.length) reasons.push('Incidencia pendiente')
  if (projection.freshness === 'stale') reasons.push('Información sin actualizar')
  if (projection.freshness === 'no_data') reasons.push('Sin información del operador')
  if (projection.unknownEventIds.length) reasons.push('Evento pendiente de clasificar')
  if (projection.lifecycle !== 'delivered') {
    const eta = projection.eta
    if (
      eta.kind === 'operator' &&
      Date.parse(eta.arrivalAt) > Date.parse(shipment.committedDeliveryAt)
    )
      reasons.push('Llegada prevista fuera de plazo')
    else if (Date.parse(cutoffAt) > Date.parse(shipment.committedDeliveryAt))
      reasons.push('Entrega pendiente fuera de plazo')
  }
  return reasons
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

export function updateAge(confirmedAt: string | undefined, cutoffAt: string) {
  if (!confirmedAt) return 'Sin ubicación confirmada'
  const minutes = Math.max(0, Math.floor((Date.parse(cutoffAt) - Date.parse(confirmedAt)) / 60_000))
  if (minutes < 1) return 'Actualizado ahora'
  if (minutes < 60) return `Actualizado hace ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `Actualizado hace ${hours} h`
  return `Actualizado hace ${Math.floor(hours / 24)} días`
}

export function arrivalsToday(items: readonly ShipmentView[], cutoffAt: string) {
  const date = (value: string) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(value))
  return items.filter(
    ({ projection }) =>
      projection.lifecycle !== 'delivered' &&
      projection.eta.kind === 'operator' &&
      Date.parse(projection.eta.arrivalAt) >= Date.parse(cutoffAt) &&
      date(projection.eta.arrivalAt) === date(cutoffAt),
  ).length
}
