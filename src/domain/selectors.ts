import type { DemoDataset, EntityId, IsoDateTime, ShipmentView, ShipmentSummary } from './contracts'
import { shipmentEvents } from './events'
import { projectShipment } from './projection'
import { canViewShipment } from './visibility'
import { attentionReasons } from './attention'

export interface TrackingState {
  dataset: DemoDataset
  identityId: EntityId
  cutoffAt: IsoDateTime
  selectedShipmentId: EntityId | null
}

/** Apply visibility before deriving any detail, count or map input. */
export function selectVisibleShipments(state: TrackingState): ShipmentView[] {
  const { dataset, cutoffAt } = state
  const identity = dataset.identities.find((item) => item.id === state.identityId)
  if (!identity) return []
  return dataset.shipments
    .filter((shipment) => canViewShipment(identity, shipment))
    .map((shipment) => {
      const events = shipmentEvents(dataset, shipment, cutoffAt)
      return {
        shipment,
        projection: projectShipment(dataset, shipment, cutoffAt),
        events,
        account: dataset.accounts.find((account) => account.id === shipment.accountId),
        origin: dataset.locations.find((location) => location.id === shipment.originSiteId),
        destination: dataset.locations.find(
          (location) => location.id === shipment.destinationLocationId,
        ),
        operators: dataset.operators.filter((operator) =>
          shipment.legs.some((leg) => leg.operatorId === operator.id),
        ),
        documents: dataset.documents.filter(
          (document) =>
            document.shipmentId === shipment.id && shipment.documentIds.includes(document.id),
        ),
        locations: dataset.locations.filter(
          (location) =>
            shipment.legs.some(
              (leg) =>
                leg.originLocationId === location.id || leg.destinationLocationId === location.id,
            ) || events.some((event) => event.locationId === location.id),
        ),
      }
    })
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
