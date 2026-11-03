import type { DemoDataset, EntityId, IsoDateTime, ShipmentView, ShipmentSummary } from './contracts'
import { shipmentEvents } from './events'
import { documentsOf, locationsById, trackShipment } from './projection'
import { canViewShipment } from './visibility'
import { attentionReasons } from './attention'
import { withActions } from './actions'

export interface TrackingState {
  dataset: DemoDataset
  identityId: EntityId
  cutoffAt: IsoDateTime
  selectedShipmentId: EntityId | null
}

const viewCache = new WeakMap<DemoDataset, Map<string, ShipmentView[]>>()

/**
 * Apply visibility before deriving any detail, count or map input. Views are memoized per
 * dataset, identity and cutoff, so unrelated store changes reuse the same derivation.
 */
export function selectVisibleShipments(state: TrackingState): ShipmentView[] {
  const { dataset, cutoffAt } = state
  const key = `${state.identityId}|${cutoffAt}`
  let byKey = viewCache.get(dataset)
  if (!byKey) {
    byKey = new Map()
    viewCache.set(dataset, byKey)
  }
  const cached = byKey.get(key)
  if (cached) return cached
  const identity = dataset.identities.find((item) => item.id === state.identityId)
  if (!identity) return []
  const locations = locationsById(dataset.locations)
  const views = dataset.shipments
    .filter((shipment) => canViewShipment(identity, shipment))
    .map((shipment): ShipmentView => {
      const events = shipmentEvents(dataset, shipment, cutoffAt)
      const track = trackShipment(dataset, shipment, cutoffAt)
      const locationIds = new Set<EntityId>()
      for (const leg of shipment.legs) {
        locationIds.add(leg.originLocationId)
        locationIds.add(leg.destinationLocationId)
      }
      for (const event of events) if (event.locationId) locationIds.add(event.locationId)
      const view = {
        shipment,
        projection: track.projection,
        events,
        account: dataset.accounts.find((account) => account.id === shipment.accountId),
        origin: locations.get(shipment.originSiteId),
        destination: locations.get(shipment.destinationLocationId),
        operators: dataset.operators.filter((operator) =>
          shipment.legs.some((leg) => leg.operatorId === operator.id),
        ),
        documents: documentsOf(dataset, shipment),
        locations: dataset.locations.filter((location) => locationIds.has(location.id)),
        incidents: track.incidents,
      }
      return { ...view, ...withActions(view, dataset, cutoffAt) }
    })
  byKey.set(key, views)
  return views
}

export function selectSelectedShipment(state: TrackingState): ShipmentView | null {
  return (
    selectVisibleShipments(state).find((item) => item.shipment.id === state.selectedShipmentId) ??
    null
  )
}

export function selectSummary(
  views: readonly ShipmentView[],
  cutoffAt: IsoDateTime,
): ShipmentSummary {
  return {
    active: views.filter(({ projection }) => projection.lifecycle === 'active').length,
    delivered: views.filter(({ projection }) => projection.lifecycle === 'delivered').length,
    attention: views.filter((item) => attentionReasons(item, cutoffAt).length > 0).length,
    upcoming: views.filter(
      ({ projection }) =>
        projection.lifecycle !== 'delivered' &&
        projection.eta.kind === 'operator' &&
        Date.parse(projection.eta.arrivalAt) >= Date.parse(cutoffAt) &&
        Date.parse(projection.eta.arrivalAt) <= Date.parse(cutoffAt) + 86_400_000,
    ).length,
  }
}
