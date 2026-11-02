import type { ShipmentView } from './contracts'

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
