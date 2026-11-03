import { unresolvedUnknownEventIds } from './attention'
import type { IncidentKind, IsoDateTime, ShipmentView } from './contracts'

export interface ShipmentChanges {
  delivered: string[]
  /** Delivered in this step after the committed date. */
  late: string[]
  opened: { reference: string; kind: IncidentKind }[]
  cleared: { reference: string; kind: IncidentKind }[]
  etaChanged: { reference: string; arrivalAt: IsoDateTime }[]
  /** Shipments that received a code pending classification, or had one superseded. */
  unclassified: string[]
  classified: string[]
}

const activeKinds = (view: ShipmentView | undefined) =>
  new Set(
    view?.incidents.filter((item) => item.condition === 'active').map((item) => item.kind) ?? [],
  )

/**
 * What changed between two snapshots of the same identity's views. Both inputs are already
 * scoped, so the summary never mentions a shipment outside the perimeter. Incidents are
 * compared by kind: a stale incident is renewed with each silent event but is the same problem.
 */
export function shipmentChanges(
  before: readonly ShipmentView[],
  after: readonly ShipmentView[],
): ShipmentChanges {
  const previous = new Map(before.map((view) => [view.shipment.id, view]))
  const changes: ShipmentChanges = {
    delivered: [],
    late: [],
    opened: [],
    cleared: [],
    etaChanged: [],
    unclassified: [],
    classified: [],
  }
  for (const view of after) {
    const old = previous.get(view.shipment.id)
    const reference = view.shipment.reference
    if (view.projection.lifecycle === 'delivered' && old?.projection.lifecycle !== 'delivered') {
      changes.delivered.push(reference)
      const deliveredAt = view.projection.lastConfirmedLocation?.confirmedAt
      if (deliveredAt && Date.parse(deliveredAt) > Date.parse(view.shipment.committedDeliveryAt))
        changes.late.push(reference)
    }
    const was = activeKinds(old)
    const now = activeKinds(view)
    for (const kind of now) if (!was.has(kind)) changes.opened.push({ reference, kind })
    for (const kind of was) if (!now.has(kind)) changes.cleared.push({ reference, kind })
    const unknownBefore = old ? unresolvedUnknownEventIds(old).length : 0
    const unknownNow = unresolvedUnknownEventIds(view).length
    if (unknownNow > unknownBefore) changes.unclassified.push(reference)
    if (unknownNow < unknownBefore) changes.classified.push(reference)
    const eta = view.projection.eta
    const oldEta = old?.projection.eta
    if (
      view.projection.lifecycle !== 'delivered' &&
      eta.kind === 'operator' &&
      oldEta?.kind === 'operator' &&
      eta.arrivalAt !== oldEta.arrivalAt
    )
      changes.etaChanged.push({ reference, arrivalAt: eta.arrivalAt })
  }
  return changes
}
