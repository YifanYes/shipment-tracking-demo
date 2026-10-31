import type {
  DemoDataset,
  DemoIdentity,
  IsoDateTime,
  LegStage,
  NormalizedEvent,
  NormalizedSignal,
  OperatorEvent,
  Shipment,
  ShipmentProjection,
} from './contracts'

export function canViewShipment(identity: DemoIdentity, shipment: Shipment): boolean {
  return identity.role === 'customer'
    ? identity.accountId === shipment.accountId
    : identity.allowedOriginSiteIds.includes(shipment.originSiteId) &&
        identity.allowedAccountIds.includes(shipment.accountId)
}

/** Operator vocabularies are explicit. Unknown codes never imply progress. */
export function normalizeEvent(event: OperatorEvent): NormalizedEvent {
  const stages: Record<string, LegStage> = {
    PICKED_UP: 'collected',
    ON_ROUTE: 'in_transit',
    DELIVERED: 'completed',
  }
  const stage =
    event.operatorId === 'operator-iberia' && Object.hasOwn(stages, event.rawCode)
      ? stages[event.rawCode]
      : undefined
  const base = {
    originalEventId: event.id,
    shipmentId: event.shipmentId,
    legId: event.legId,
    occurredAt: event.occurredAt,
  }
  if (!stage)
    return {
      ...base,
      mapping: 'unknown',
      reason: 'Código del operador pendiente de clasificación.',
    }
  const signals: NormalizedSignal[] = [{ kind: 'progress', stage }]
  const arrivalAt = event.payload.arrivalAt
  if (typeof arrivalAt === 'string' && Number.isFinite(Date.parse(arrivalAt))) {
    signals.push({ kind: 'eta_updated', arrivalAt })
  }
  return { ...base, mapping: 'known', signals }
}

/** Only facts that happened AND were received by the cutoff can be shown. */
export function shipmentEvents(
  dataset: DemoDataset,
  shipment: Shipment,
  cutoffAt: IsoDateTime,
): OperatorEvent[] {
  const seen = new Set<string>()
  return dataset.events
    .filter((event) => {
      const leg = shipment.legs.find((item) => item.id === event.legId)
      if (
        event.shipmentId !== shipment.id ||
        !leg ||
        leg.operatorId !== event.operatorId ||
        Date.parse(event.occurredAt) > Date.parse(cutoffAt) ||
        Date.parse(event.receivedAt) > Date.parse(cutoffAt) ||
        seen.has(event.id)
      )
        return false
      seen.add(event.id)
      return true
    })
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt) || a.id.localeCompare(b.id))
}

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
