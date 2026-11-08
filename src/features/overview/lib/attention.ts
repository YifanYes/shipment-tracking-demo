import type { IncidentKind, ShipmentIncident, ShipmentView } from '@/domain/contracts'
import { attentionReasons, needsAction } from '@/domain/attention'

export const incidentKindLabels: Record<IncidentKind, string> = {
  delay: 'Retraso',
  hold: 'Retención',
  stale: 'Información sin actualizar',
  customs: 'Retenido en aduana',
  missing_document: 'Falta documentación',
}

export const severityLabels: Record<ShipmentIncident['severity'], string> = {
  critical: 'crítica',
  high: 'alta',
  medium: 'media',
  low: 'baja',
}

const severityRank: Record<ShipmentIncident['severity'], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export function activeIncidents(item: ShipmentView) {
  return item.incidents
    .filter((incident) => incident.condition === 'active')
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
}

export interface AttentionLine {
  key: string
  label: string
  severity?: ShipmentIncident['severity']
  attention?: ShipmentIncident['attention']
}

/** The first thing to do on a shipment, urgent actions first. */
export function nextAction(item: ShipmentView) {
  return (
    item.recommendations.find((action) => action.priority === 'urgent') ?? item.recommendations[0]
  )
}

export const attentionStateLabels: Record<ShipmentIncident['attention'], string> = {
  unreviewed: 'Sin revisar',
  in_progress: 'En gestión',
  handled: 'Atendida',
}

/**
 * The same reasons as `attentionReasons`, with the generic pending-incident reason replaced by
 * each active incident. Repeated labels are shown once.
 */
export function attentionLines(item: ShipmentView, cutoffAt: string): AttentionLine[] {
  const incidents = activeIncidents(item)
  const lines: AttentionLine[] = incidents.map((incident) => ({
    key: incident.id,
    label: incidentKindLabels[incident.kind],
    severity: incident.severity,
    attention: incident.attention,
  }))
  for (const reason of attentionReasons(item, cutoffAt)) {
    if (reason === 'Incidencia pendiente' && incidents.length) continue
    lines.push({ key: reason, label: reason })
  }
  return lines.filter(
    (line, index) => lines.findIndex((entry) => entry.label === line.label) === index,
  )
}

/**
 * Shipments that need attention. What someone can act on goes first, so a handled incident never
 * hides a pending one; then the most severe incident, number of reasons and nearest commitment.
 */
export function attentionQueue(shipments: readonly ShipmentView[], cutoffAt: string) {
  return shipments
    .map((item) => ({
      item,
      reasons: attentionReasons(item, cutoffAt).length,
      pending: needsAction(item, cutoffAt),
      severity: Math.max(0, ...activeIncidents(item).map((entry) => severityRank[entry.severity])),
    }))
    .filter(({ reasons }) => reasons > 0)
    .sort(
      (a, b) =>
        Number(b.pending) - Number(a.pending) ||
        b.severity - a.severity ||
        b.reasons - a.reasons ||
        Date.parse(a.item.shipment.committedDeliveryAt) -
          Date.parse(b.item.shipment.committedDeliveryAt) ||
        a.item.shipment.reference.localeCompare(b.item.shipment.reference),
    )
    .map(({ item }) => item)
}
