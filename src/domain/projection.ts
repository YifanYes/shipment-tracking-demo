import type { DemoDataset, IsoDateTime, LegStage, Shipment, ShipmentProjection } from './contracts'
import { normalizeEvent, shipmentEvents } from './events'

export function projectShipment(
  dataset: DemoDataset,
  shipment: Shipment,
  cutoffAt: IsoDateTime,
): ShipmentProjection {
  const events = shipmentEvents(dataset, shipment, cutoffAt)
  const legs = [...shipment.legs].sort((a, b) => a.sequence - b.sequence)
  const stages = new Map(legs.map((leg) => [leg.id, 'planned' as LegStage]))
  let eta: ShipmentProjection['eta'] = {
    kind: 'unavailable',
    reason: 'No hay una ETA comunicada por el operador.',
  }
  let lastConfirmedLocation: ShipmentProjection['lastConfirmedLocation'] = null
  let lastConfirmedAt: string | null = null
  const unknownEventIds: string[] = []

  for (const event of events) {
    const normalized = normalizeEvent(event)
    if (normalized.mapping === 'unknown') {
      unknownEventIds.push(event.id)
      continue
    }
    const leg = legs.find((item) => item.id === event.legId)!
    for (const signal of normalized.signals) {
      if (signal.kind === 'eta_updated') {
        eta = {
          kind: 'operator',
          arrivalAt: signal.arrivalAt,
          issuedAt: event.occurredAt,
          operatorId: event.operatorId,
          evidence: [{ kind: 'operator_event', id: event.id }],
        }
      }
      if (signal.kind !== 'progress') continue
      const previous = stages.get(leg.id) ?? 'planned'
      if (
        leg.milestones.includes(signal.stage) &&
        leg.milestones.indexOf(signal.stage) >= leg.milestones.indexOf(previous)
      ) {
        stages.set(leg.id, signal.stage)
        lastConfirmedAt = event.occurredAt
        if (
          event.locationId &&
          dataset.locations.some((location) => location.id === event.locationId)
        ) {
          lastConfirmedLocation = {
            locationId: event.locationId,
            confirmedAt: event.occurredAt,
            evidence: { kind: 'operator_event', id: event.id },
          }
        }
      }
    }
  }
  const delivered = legs.length > 0 && legs.every((leg) => stages.get(leg.id) === 'completed')
  const currentLeg = legs.find((leg) => stages.get(leg.id) !== 'completed') ?? legs.at(-1)
  const currentStage = currentLeg ? stages.get(currentLeg.id)! : null
  const staleHours = currentLeg?.mode === 'sea' ? 24 : 4
  return {
    shipmentId: shipment.id,
    lifecycle: delivered
      ? 'delivered'
      : [...stages.values()].some((stage) => stage !== 'planned')
        ? 'active'
        : 'planned',
    currentLegId: currentLeg?.id ?? null,
    currentStage,
    eta,
    freshness: !lastConfirmedAt
      ? 'no_data'
      : !delivered && Date.parse(cutoffAt) - Date.parse(lastConfirmedAt) > staleHours * 3_600_000
        ? 'stale'
        : 'current',
    lastConfirmedLocation,
    incidentIds: [],
    unknownEventIds,
  }
}
