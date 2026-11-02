import type {
  DemoDataset,
  IsoDateTime,
  LegStage,
  NormalizedEvent,
  NormalizedSignal,
  OperatorEvent,
  Shipment,
} from './contracts'

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
