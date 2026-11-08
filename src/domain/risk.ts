import type { DelayRisk, EntityId, EvidenceReference, IsoDateTime, ShipmentView } from './contracts'

const HOUR = 3_600_000
/** How close the commitment must be for an open problem to threaten it. */
const HOLD_WINDOW_HOURS = 72
const STALE_WINDOW_HOURS = 24
const TIGHT_MARGIN_HOURS = 2

const HIGH = 0.7
const MEDIUM = 0.5

/** Free-text signals in operator messages. In production, an LLM extraction with its evidence. */
const disruptions: readonly { pattern: RegExp; text: string }[] = [
  { pattern: /reduced speed|weather|storm|temporal/i, text: 'velocidad reducida por mal tiempo' },
  { pattern: /aver[ií]a|breakdown/i, text: 'una avería' },
]

interface Factor {
  weight: number
  text: string
  evidence?: EntityId
}

export const riskIncidentId = (shipmentId: EntityId) => `risk-${shipmentId}`

/**
 * Early warning for an open shipment that nobody has declared late yet. Always an estimate: it
 * never changes the status, the ETA or the incidents, and disappears once the operator confirms
 * a delay. Levels instead of percentages, because a mock score must not imply false precision.
 */
export function assessDelayRisk(
  view: Pick<ShipmentView, 'shipment' | 'projection' | 'events' | 'incidents'>,
  cutoffAt: IsoDateTime,
): DelayRisk | null {
  const { shipment, projection, events, incidents } = view
  if (projection.lifecycle === 'delivered') return null
  const open = incidents.filter((incident) => incident.condition === 'active')
  if (open.some((incident) => incident.kind === 'delay')) return null

  const committed = Date.parse(shipment.committedDeliveryAt)
  const hoursLeft = (committed - Date.parse(cutoffAt)) / HOUR
  if (hoursLeft <= 0) return null
  const left = Math.round(hoursLeft)
  const eta = projection.eta
  const factors: Factor[] = []

  const firstEvent = (ids: readonly EvidenceReference[]) =>
    ids.find((reference) => reference.kind === 'operator_event')?.id

  const hold = open.find((incident) => incident.kind === 'customs' || incident.kind === 'hold')
  if (hold && hoursLeft <= HOLD_WINDOW_HOURS)
    factors.push({
      weight: 0.7,
      text: `Retenido desde hace ${Math.round((Date.parse(cutoffAt) - Date.parse(hold.openedAt)) / HOUR)} h, con la entrega comprometida en ${left} h.`,
      evidence: firstEvent(hold.evidence),
    })

  const stale = open.find((incident) => incident.kind === 'stale')
  if (stale && hoursLeft <= STALE_WINDOW_HOURS) {
    const last = events.at(-1)
    factors.push({
      weight: 0.7,
      text: `Sin noticias del operador${last ? ` desde hace ${Math.round((Date.parse(cutoffAt) - Date.parse(last.occurredAt)) / HOUR)} h` : ''}, con la entrega comprometida en ${left} h.`,
      evidence: firstEvent(stale.evidence),
    })
  }

  // Only news the operator's latest ETA cannot have taken into account yet.
  const last = events.at(-1)
  const newsAfterEta =
    last && (eta.kind !== 'operator' || Date.parse(last.occurredAt) > Date.parse(eta.issuedAt))
  const disruption =
    newsAfterEta && disruptions.find(({ pattern }) => pattern.test(last.rawMessage))
  if (disruption)
    factors.push({
      weight: MEDIUM,
      text: `El operador informa de ${disruption.text} después de su última ETA.`,
      evidence: last.id,
    })

  if (eta.kind === 'estimate' && Date.parse(eta.latestAt) > committed)
    factors.push({
      weight: MEDIUM,
      text: 'El intervalo estimado termina después de la fecha comprometida.',
      evidence: firstEvent(eta.evidence),
    })

  if (eta.kind === 'operator') {
    const margin = (committed - Date.parse(eta.arrivalAt)) / HOUR
    if (margin >= 0 && margin < TIGHT_MARGIN_HOURS)
      factors.push({
        weight: 0.3,
        text: 'La ETA del operador deja menos de 2 h de margen.',
        evidence: firstEvent(eta.evidence),
      })
  }

  const score = factors.reduce((sum, factor) => sum + factor.weight, 0)
  if (score < MEDIUM) return null
  return {
    id: riskIncidentId(shipment.id),
    shipmentId: shipment.id,
    level: score >= HIGH ? 'high' : 'medium',
    factors: factors.map((factor) => factor.text),
    evidence: factors.flatMap((factor) =>
      factor.evidence ? [{ kind: 'operator_event' as const, id: factor.evidence }] : [],
    ),
  }
}
