import type {
  DemoDataset,
  EntityId,
  EvidenceReference,
  IncidentKind,
  IsoDateTime,
  Shipment,
  ShipmentDocument,
  ShipmentIncident,
} from './contracts'
import { trackShipment, type ShipmentTimeline } from './projection'

const HOUR = 3_600_000

interface Draft {
  id: EntityId
  kind: IncidentKind
  legId?: EntityId
  openedAt: IsoDateTime
  clearedAt?: IsoDateTime
  evidence: EvidenceReference[]
  /** Delay only: largest lateness against the commitment, in hours. */
  lateHours?: number
}

export interface IncidentInput {
  shipment: Shipment
  timeline: ShipmentTimeline
  documents: readonly ShipmentDocument[]
  cutoffAt: IsoDateTime
  stale: { since: IsoDateTime; evidenceEventId: EntityId; legId?: EntityId } | null
  etaAvailable: boolean
}

function addEvidence(draft: Draft, reference: EvidenceReference) {
  if (!draft.evidence.some((item) => item.kind === reference.kind && item.id === reference.id))
    draft.evidence.push(reference)
}

/**
 * Rules, all evaluated on facts visible at the cutoff:
 * - delay: an operator delay notice, an operator ETA after the commitment, or the commitment
 *   passing without delivery. Cleared on delivery or by a later ETA within the commitment.
 * - customs / hold: opened and cleared only by the operator's hold and release events.
 * - missing_document: a missing document of the shipment, or one requested by the operator
 *   before it was uploaded. Cleared when the document is available, independently of customs.
 * - stale: only while the information is stale; past gaps are not reconstructed.
 */
export function incidentsFromTimeline(input: IncidentInput): ShipmentIncident[] {
  const { shipment, timeline, cutoffAt } = input
  const cutoff = Date.parse(cutoffAt)
  const committed = Date.parse(shipment.committedDeliveryAt)
  const drafts: Draft[] = []
  const active = new Map<IncidentKind, Draft>()
  const documentRequests = new Map<EntityId, { at: IsoDateTime; eventId: EntityId }>()
  let delay: (Draft & { overdue: boolean }) | null = null
  let delivered = false

  const openOverdue = (): Draft & { overdue: boolean } => {
    const draft: Draft & { overdue: boolean } = {
      id: `incident-${shipment.id}-overdue`,
      kind: 'delay',
      openedAt: shipment.committedDeliveryAt,
      evidence: [{ kind: 'shipment', id: shipment.id }],
      overdue: true,
      lateHours: 0,
    }
    drafts.push(draft)
    return draft
  }

  for (const { event, signals } of timeline.entries) {
    const at = Date.parse(event.occurredAt)
    const reference = { kind: 'operator_event', id: event.id } as const
    if (!delivered && !delay && at > committed) delay = openOverdue()
    for (const signal of signals) {
      if (signal.kind === 'eta_updated') {
        const late = (Date.parse(signal.arrivalAt) - committed) / HOUR
        if (late > 0) {
          if (!delay) {
            delay = {
              id: `incident-${event.id}-delay`,
              kind: 'delay',
              legId: event.legId,
              openedAt: event.occurredAt,
              evidence: [],
              overdue: false,
              lateHours: 0,
            }
            drafts.push(delay)
          }
          addEvidence(delay, reference)
          delay.lateHours = Math.max(delay.lateHours ?? 0, late)
        } else if (delay && !delay.overdue && at <= committed) {
          delay.clearedAt = event.occurredAt
          addEvidence(delay, reference)
          delay = null
        }
        continue
      }
      if (signal.kind === 'progress') continue
      const kind = signal.incidentKind
      if (kind === 'delay') {
        if (signal.kind === 'incident_opened') {
          if (!delay) {
            delay = {
              id: `incident-${event.id}-delay`,
              kind,
              legId: event.legId,
              openedAt: event.occurredAt,
              evidence: [],
              overdue: false,
              lateHours: 0,
            }
            drafts.push(delay)
          }
          addEvidence(delay, reference)
        } else if (delay && !delay.overdue) {
          delay.clearedAt = event.occurredAt
          addEvidence(delay, reference)
          delay = null
        }
        continue
      }
      const documentId = event.payload.documentId
      if (
        kind === 'missing_document' &&
        signal.kind === 'incident_opened' &&
        typeof documentId === 'string' &&
        input.documents.some((document) => document.id === documentId)
      ) {
        if (!documentRequests.has(documentId))
          documentRequests.set(documentId, { at: event.occurredAt, eventId: event.id })
        continue
      }
      const current = active.get(kind)
      if (signal.kind === 'incident_opened') {
        if (current) addEvidence(current, reference)
        else {
          const draft: Draft = {
            id: `incident-${event.id}-${kind}`,
            kind,
            legId: event.legId,
            openedAt: event.occurredAt,
            evidence: [reference],
          }
          drafts.push(draft)
          active.set(kind, draft)
        }
      } else if (current) {
        current.clearedAt = event.occurredAt
        addEvidence(current, reference)
        active.delete(kind)
      }
    }
    if (timeline.deliveredAt?.eventId === event.id) {
      delivered = true
      if (delay) {
        const late = (at - committed) / HOUR
        delay.lateHours = Math.max(delay.lateHours ?? 0, late)
        delay.clearedAt = event.occurredAt
        addEvidence(delay, reference)
        delay = null
      }
    }
  }
  if (!delivered && !delay && cutoff > committed) delay = openOverdue()
  const openDelay = delay as (Draft & { overdue: boolean }) | null
  if (openDelay?.overdue)
    openDelay.lateHours = Math.max(openDelay.lateHours ?? 0, (cutoff - committed) / HOUR)

  for (const document of input.documents) {
    const uploaded = document.uploadedAt ? Date.parse(document.uploadedAt) : -Infinity
    const available = document.state === 'available' && uploaded <= cutoff
    const request = documentRequests.get(document.id)
    const evidence: EvidenceReference[] = [{ kind: 'document', id: document.id }]
    if (request) evidence.push({ kind: 'operator_event', id: request.eventId })
    const draft: Draft = {
      id: `incident-${document.id}-missing`,
      kind: 'missing_document',
      openedAt: request?.at ?? shipment.createdAt,
      evidence,
    }
    if (!available) {
      if (Date.parse(draft.openedAt) <= cutoff) drafts.push(draft)
    } else if (request && uploaded > Date.parse(request.at)) {
      drafts.push({ ...draft, clearedAt: document.uploadedAt })
    }
  }

  if (input.stale)
    drafts.push({
      id: `incident-${shipment.id}-stale-${input.stale.evidenceEventId}`,
      kind: 'stale',
      legId: input.stale.legId,
      openedAt: input.stale.since,
      evidence: [{ kind: 'operator_event', id: input.stale.evidenceEventId }],
    })

  const span = (draft: Draft): readonly [number, number] => [
    Date.parse(draft.openedAt),
    draft.clearedAt ? Date.parse(draft.clearedAt) : cutoff,
  ]
  /** A document blocks clearance when it was missing while the shipment was held at customs. */
  const blocksCustoms = (document: Draft) => {
    const [from, to] = span(document)
    return drafts.some((draft) => {
      if (draft.kind !== 'customs') return false
      const [heldFrom, heldTo] = span(draft)
      return heldFrom <= to && from <= heldTo
    })
  }
  return drafts
    .map((draft): ShipmentIncident => {
      const severity: ShipmentIncident['severity'] =
        draft.kind === 'customs'
          ? 'high'
          : draft.kind === 'missing_document'
            ? blocksCustoms(draft)
              ? 'high'
              : 'medium'
            : draft.kind === 'delay'
              ? (draft.lateHours ?? 0) > 24 || draft.id.endsWith('-overdue')
                ? 'high'
                : 'medium'
              : draft.kind === 'stale'
                ? input.etaAvailable
                  ? 'medium'
                  : 'high'
                : 'medium'
      return {
        id: draft.id,
        shipmentId: shipment.id,
        ...(draft.legId ? { legId: draft.legId } : {}),
        kind: draft.kind,
        severity,
        condition: draft.clearedAt ? 'cleared' : 'active',
        attention: 'unreviewed',
        openedAt: draft.openedAt,
        ...(draft.clearedAt ? { clearedAt: draft.clearedAt } : {}),
        evidence: draft.evidence,
      }
    })
    .sort((a, b) => Date.parse(a.openedAt) - Date.parse(b.openedAt) || a.id.localeCompare(b.id))
}

/**
 * Incidents derived from the shipment's visible events and documents at the cutoff.
 * Stable IDs, evidence linked to original events or documents, `attention: 'unreviewed'`
 * until phase 3 adds actions.
 */
export function deriveIncidents(
  dataset: DemoDataset,
  shipment: Shipment,
  cutoffAt: IsoDateTime,
): ShipmentIncident[] {
  return [...trackShipment(dataset, shipment, cutoffAt).incidents]
}
