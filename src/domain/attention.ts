import type { ActivityRecord, ShipmentView } from './contracts'
import { normalizeEvent } from './events'
import { assessDelayRisk } from './risk'

/**
 * Unknown codes stay in the timeline, but only need attention until a person classifies them
 * or the operator confirms a later known event on the same leg.
 */
export function unresolvedUnknownEventIds(
  item: Pick<ShipmentView, 'projection' | 'events'> & { activity?: readonly ActivityRecord[] },
): string[] {
  const known = item.events.filter((event) => normalizeEvent(event).mapping === 'known')
  const classified = new Set(item.activity?.map((record) => record.eventId))
  return item.projection.unknownEventIds.filter((id) => {
    if (classified.has(id)) return false
    const unknown = item.events.find((event) => event.id === id)
    return (
      !unknown ||
      !known.some(
        (event) =>
          event.legId === unknown.legId &&
          Date.parse(event.occurredAt) > Date.parse(unknown.occurredAt),
      )
    )
  })
}

export const DELAY_RISK_REASON = 'Riesgo de retraso · estimación IA'

export function attentionReasons(item: ShipmentView, cutoffAt: string): string[] {
  const { projection, shipment } = item
  const reasons: string[] = []
  if (projection.incidentIds.length) reasons.push('Incidencia pendiente')
  // A delivered shipment only needs attention for what is still open, such as a document.
  if (projection.lifecycle === 'delivered') return reasons
  if (projection.freshness === 'stale') reasons.push('Información sin actualizar')
  if (projection.freshness === 'no_data') reasons.push('Sin información del operador')
  if (unresolvedUnknownEventIds(item).length) reasons.push('Evento pendiente de clasificar')
  const eta = projection.eta
  if (
    eta.kind === 'operator' &&
    Date.parse(eta.arrivalAt) > Date.parse(shipment.committedDeliveryAt)
  )
    reasons.push('Llegada prevista fuera de plazo')
  else if (Date.parse(cutoffAt) > Date.parse(shipment.committedDeliveryAt))
    reasons.push('Entrega pendiente fuera de plazo')
  if (assessDelayRisk(item, cutoffAt)) reasons.push(DELAY_RISK_REASON)
  return reasons
}

/**
 * A shipment with a problem whose proposed actions have all been recorded is waiting for the
 * operator: it stays visible, but nobody has anything to do on it right now.
 */
export function needsAction(item: ShipmentView, cutoffAt: string) {
  if (!attentionReasons(item, cutoffAt).length) return false
  return item.recommendations.length > 0 || item.activity.length === 0
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
