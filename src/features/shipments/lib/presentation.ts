import type {
  ArrivalEstimate,
  EvidenceReference,
  IncidentKind,
  LegStage,
  NormalizedSignal,
  OperatorEvent,
  ShipmentDocument,
  ShipmentIncident,
  ShipmentView,
  TransportMode,
} from '@/domain/contracts'
import { normalizeEvent } from '@/domain/events'
import { formatTime, stageLabels } from '@/shared/lib/format'

export type Audience = 'operations' | 'customer'

export const modeLabels: Record<TransportMode, string> = { road: 'Carretera', sea: 'Mar' }

export const incidentKindLabels: Record<IncidentKind, string> = {
  delay: 'Retraso',
  hold: 'Retención',
  stale: 'Sin actualizaciones',
  customs: 'Aduana',
  missing_document: 'Documentación pendiente',
}

export const severityLabels: Record<ShipmentIncident['severity'], string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica',
}

const severityRank: Record<ShipmentIncident['severity'], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export const documentKindLabels: Record<ShipmentDocument['kind'], string> = {
  packing_list: 'Lista de bultos',
  delivery_note: 'Albarán de entrega',
  customs: 'Documento aduanero',
  bill_of_lading: 'Conocimiento de embarque',
}

export const freshnessLabels: Record<ShipmentView['projection']['freshness'], string> = {
  current: 'Información al día',
  stale: 'Información desactualizada',
  no_data: 'Sin actualizaciones',
}

const customerIncidentText: Record<IncidentKind, string> = {
  delay: 'El operador informa de un retraso.',
  hold: 'El envío está retenido.',
  stale: 'El operador no ha enviado actualizaciones recientes.',
  customs: 'El envío está retenido en aduana.',
  missing_document: 'Falta documentación del envío.',
}

const pastIncidentText: Partial<Record<IncidentKind, string>> = {
  hold: 'Estuvo retenido.',
  customs: 'Estuvo retenido en aduana.',
  missing_document: 'Faltó documentación del envío.',
}

const incidentText = (incident: ShipmentIncident) => {
  if (incident.condition === 'cleared') return pastIncidentText[incident.kind]
  return incident.kind === 'delay' && incident.id.endsWith('-overdue')
    ? 'Ha pasado la fecha comprometida sin confirmar la entrega.'
    : customerIncidentText[incident.kind]
}

/** Distinct modes in leg order, e.g. "Carretera + Mar". */
export function legModesLabel(view: ShipmentView) {
  return [...new Set(sortedLegs(view).map((leg) => modeLabels[leg.mode]))].join(' + ')
}

export function sortedLegs(view: ShipmentView) {
  return [...view.shipment.legs].sort((a, b) => a.sequence - b.sequence)
}

export function operatorName(view: ShipmentView, operatorId: string | undefined) {
  return view.operators.find((operator) => operator.id === operatorId)?.name ?? 'Operador'
}

export function locationName(view: ShipmentView, locationId: string | undefined) {
  return view.locations.find((location) => location.id === locationId)?.name ?? 'Sin datos'
}

export function activeIncidents(view: ShipmentView) {
  return view.incidents.filter((incident) => incident.condition === 'active')
}

/** Active first, then by severity and most recent opening. */
export function sortIncidents(incidents: readonly ShipmentIncident[]) {
  return [...incidents].sort(
    (a, b) =>
      Number(a.condition !== 'active') - Number(b.condition !== 'active') ||
      severityRank[a.severity] - severityRank[b.severity] ||
      Date.parse(b.openedAt) - Date.parse(a.openedAt),
  )
}

function isHeld(view: ShipmentView) {
  return activeIncidents(view).find((incident) => ['customs', 'hold'].includes(incident.kind))
}

/** Operations label: the confirmed stage of the current leg. */
export function operationsStatus(view: ShipmentView) {
  const { projection } = view
  if (projection.lifecycle === 'delivered') return stageLabels.completed
  if (projection.lifecycle === 'planned') return stageLabels.planned
  if (!projection.currentStage) return 'Sin estado confirmado'
  if (projection.currentStage === 'planned') {
    const leg = sortedLegs(view).find((entry) => entry.id === projection.currentLegId)
    return leg ? `Tramo ${leg.sequence} pendiente de inicio` : stageLabels.planned
  }
  return stageLabels[projection.currentStage]
}

/** Customer label: plain status, holds take precedence over transport progress. */
export function customerStatus(view: ShipmentView) {
  const { projection } = view
  if (projection.lifecycle === 'delivered') return 'Entregado'
  const hold = isHeld(view)
  if (hold) return hold.kind === 'customs' ? 'Retenido en aduana' : 'Retenido'
  if (projection.lifecycle === 'planned') return 'Preparando el envío'
  switch (projection.currentStage) {
    case 'collected':
    case 'at_origin_terminal':
    case 'loaded':
      return 'Recogido'
    case 'in_transit':
    case 'planned':
      return 'En camino'
    case 'at_destination_terminal':
      return 'Llegando a destino'
    case 'customs':
      return 'En aduana'
    case 'out_for_delivery':
      return 'En reparto'
    default:
      return 'En camino'
  }
}

export function statusLabel(view: ShipmentView, audience: Audience) {
  return audience === 'customer' ? customerStatus(view) : operationsStatus(view)
}

/** Time of the event that completed the last leg, if it is visible. */
export function deliveredAt(view: ShipmentView): string | null {
  if (view.projection.lifecycle !== 'delivered') return null
  const lastLeg = sortedLegs(view).at(-1)
  const event = [...view.events].reverse().find((entry) => {
    if (entry.legId !== lastLeg?.id) return false
    const normalized = normalizeEvent(entry)
    return (
      normalized.mapping === 'known' &&
      normalized.signals.some(
        (signal) => signal.kind === 'progress' && signal.stage === 'completed',
      )
    )
  })
  return event?.occurredAt ?? view.projection.lastConfirmedLocation?.confirmedAt ?? null
}

/** Earliest expected arrival used for ordering; null when there is no evidence. */
export function expectedArrival(eta: ArrivalEstimate): string | null {
  if (eta.kind === 'operator') return eta.arrivalAt
  if (eta.kind === 'estimate') return eta.earliestAt
  return null
}

export function etaValue(eta: ArrivalEstimate) {
  if (eta.kind === 'operator') return formatTime(eta.arrivalAt)
  if (eta.kind === 'estimate') return `${formatTime(eta.earliestAt)} – ${formatTime(eta.latestAt)}`
  return 'Sin previsión'
}

export const etaKindLabels: Record<ArrivalEstimate['kind'], string> = {
  operator: 'ETA del operador',
  estimate: 'Estimación',
  unavailable: 'Llegada prevista',
}

/**
 * Minutes beyond the committed date: confirmed delivery, operator ETA or the earliest bound of
 * an estimate. Without evidence, an open shipment past its commitment counts from the cutoff.
 */
export function delayMinutes(view: ShipmentView, cutoffAt: string): number | null {
  const committed = Date.parse(view.shipment.committedDeliveryAt)
  const delivered = deliveredAt(view)
  const reference =
    view.projection.lifecycle === 'delivered'
      ? delivered
      : (expectedArrival(view.projection.eta) ??
        (Date.parse(cutoffAt) > committed ? cutoffAt : null))
  if (!reference) return null
  return Math.round((Date.parse(reference) - committed) / 60_000)
}

export function formatDuration(minutes: number) {
  const value = Math.abs(minutes)
  if (value < 60) return `${value} min`
  const hours = Math.round(value / 60)
  if (hours < 48) return `${hours} h`
  const days = Math.round(hours / 24)
  return `${days} ${days === 1 ? 'día' : 'días'}`
}

export interface EtaChange {
  eventId: string
  issuedAt: string
  previousAt: string | null
  arrivalAt: string
}

/** ETA updates communicated by operators, oldest first. */
export function etaChanges(view: ShipmentView): EtaChange[] {
  const changes: EtaChange[] = []
  for (const event of view.events) {
    const normalized = normalizeEvent(event)
    if (normalized.mapping !== 'known') continue
    for (const signal of normalized.signals) {
      if (signal.kind !== 'eta_updated') continue
      const previousAt = changes.at(-1)?.arrivalAt ?? null
      if (previousAt === signal.arrivalAt) continue
      changes.push({
        eventId: event.id,
        issuedAt: event.occurredAt,
        previousAt,
        arrivalAt: signal.arrivalAt,
      })
    }
  }
  return changes
}

/** Sentences explaining a delay to a customer: incidents and the latest ETA change. */
export function delayExplanation(view: ShipmentView): string[] {
  const relevant =
    view.projection.lifecycle === 'delivered' ? view.incidents : activeIncidents(view)
  const reasons = [
    ...new Set(
      sortIncidents(relevant)
        .map(incidentText)
        .filter((text): text is string => Boolean(text)),
    ),
  ]
  const latest = etaChanges(view).at(-1)
  if (latest?.previousAt) {
    const shift = Math.round(
      (Date.parse(latest.arrivalAt) - Date.parse(latest.previousAt)) / 60_000,
    )
    if (shift !== 0)
      reasons.push(
        `El ${formatTime(latest.issuedAt)} la llegada prevista ${shift > 0 ? 'se retrasó' : 'se adelantó'} ${formatDuration(shift)}.`,
      )
  }
  return reasons
}

/** 'completed' only means delivery on the final leg; earlier legs just finish. */
export function stageLabel(stage: LegStage, finalLeg: boolean) {
  return stage === 'completed' && !finalLeg ? 'Tramo completado' : stageLabels[stage]
}

export function signalTitle(signal: NormalizedSignal, finalLeg = true) {
  switch (signal.kind) {
    case 'progress':
      return stageLabel(signal.stage, finalLeg)
    case 'eta_updated':
      return 'ETA actualizada'
    case 'incident_opened':
      return `Incidencia: ${incidentKindLabels[signal.incidentKind]}`
    case 'incident_cleared':
      return `Resuelta: ${incidentKindLabels[signal.incidentKind]}`
  }
}

/** Normalization shown to operations next to the original code. */
export function signalDetail(signal: NormalizedSignal, finalLeg = true) {
  switch (signal.kind) {
    case 'progress':
      return `Hito ${stageLabel(signal.stage, finalLeg).toLowerCase()}`
    case 'eta_updated':
      return `ETA ${formatTime(signal.arrivalAt)}`
    case 'incident_opened':
      return `Abre incidencia de ${incidentKindLabels[signal.incidentKind].toLowerCase()}`
    case 'incident_cleared':
      return `Cierra incidencia de ${incidentKindLabels[signal.incidentKind].toLowerCase()}`
  }
}

const customerStageText: Partial<Record<LegStage, string>> = {
  collected: 'El operador ha recogido el envío.',
  at_origin_terminal: 'El envío está en la terminal de origen.',
  loaded: 'El envío se ha cargado.',
  in_transit: 'El envío está en camino.',
  at_destination_terminal: 'El envío ha llegado a la terminal de destino.',
  customs: 'El envío está en trámite de aduana.',
  out_for_delivery: 'El envío está en reparto.',
  completed: 'Tramo completado.',
}

function customerSignalText(signal: NormalizedSignal) {
  switch (signal.kind) {
    case 'progress':
      return customerStageText[signal.stage] ?? null
    case 'eta_updated':
      return `Nueva llegada prevista: ${formatTime(signal.arrivalAt)}.`
    case 'incident_opened':
      return customerIncidentText[signal.incidentKind]
    case 'incident_cleared':
      return `Resuelto: ${incidentKindLabels[signal.incidentKind].toLowerCase()}.`
  }
}

export interface TimelineEntry {
  event: OperatorEvent
  title: string
  /** Normalization details (operations) or a plain-language message (customer). */
  details: string[]
  known: boolean
  stage?: LegStage
  /** Completion of the final leg, the only event that means delivery. */
  delivered?: boolean
}

/**
 * Most recent first. Customers only see classified events, without codes or raw messages.
 */
export function timelineEntries(view: ShipmentView, audience: Audience): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  for (const event of [...view.events].reverse()) {
    const normalized = normalizeEvent(event)
    if (normalized.mapping === 'unknown') {
      if (audience === 'customer') continue
      entries.push({
        event,
        title: 'Pendiente de clasificación',
        details: [normalized.reason],
        known: false,
      })
      continue
    }
    const progress = normalized.signals.find((signal) => signal.kind === 'progress')
    const lead = progress ?? normalized.signals[0]
    const finalLeg = sortedLegs(view).at(-1)?.id === event.legId
    const isLastLegCompletion =
      progress?.kind === 'progress' && progress.stage === 'completed' && finalLeg
    entries.push({
      event,
      title: lead ? signalTitle(lead, finalLeg) : 'Actualización del operador',
      details:
        audience === 'customer'
          ? normalized.signals
              .map((signal) =>
                isLastLegCompletion && signal.kind === 'progress'
                  ? 'Entrega confirmada.'
                  : customerSignalText(signal),
              )
              .filter((text): text is string => Boolean(text))
          : normalized.signals.map((signal) => signalDetail(signal, finalLeg)),
      known: true,
      stage: progress?.kind === 'progress' ? progress.stage : undefined,
      delivered: isLastLegCompletion,
    })
  }
  return entries
}

export function evidenceTargetId(reference: EvidenceReference) {
  return reference.kind === 'operator_event'
    ? `event-${reference.id}`
    : reference.kind === 'document'
      ? `document-${reference.id}`
      : null
}
