import { AlertTriangle, Link2 } from 'lucide-react'
import type { EvidenceReference, ShipmentIncident, ShipmentView } from '@/domain/contracts'
import { AiBadge } from '@/shared/ui/ai-badge'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { formatTime } from '@/shared/lib/format'
import { explainIncident } from '@/domain/actions'
import { focusEvidence } from '../lib/evidence'
import { IncidentActions, type RecordAction } from './incident-actions'
import {
  evidenceTargetId,
  incidentKindLabels,
  modeLabels,
  severityLabels,
  sortIncidents,
  type Audience,
} from '../lib/presentation'

const attentionLabels: Record<ShipmentIncident['attention'], string> = {
  unreviewed: 'Sin revisar',
  in_progress: 'En gestión',
  handled: 'Atendida',
}

export function ShipmentIncidents({
  view,
  audience,
  visibleEventIds,
  cutoffAt,
  onOpenShipment,
  onRecordAction,
}: {
  view: ShipmentView
  audience: Audience
  visibleEventIds: ReadonlySet<string>
  cutoffAt: string
  onOpenShipment?: (id: string) => void
  /** Operations only: records a recommended action of this shipment. */
  onRecordAction?: RecordAction
}) {
  if (!view.incidents.length) return null
  const legs = new Map(view.shipment.legs.map((leg) => [leg.id, leg]))

  const evidenceLabel = (reference: EvidenceReference) => {
    if (reference.kind === 'document')
      return view.documents.find((document) => document.id === reference.id)?.name ?? null
    if (reference.kind === 'operator_event') {
      if (!visibleEventIds.has(reference.id)) return null
      const event = view.events.find((entry) => entry.id === reference.id)
      if (!event) return null
      return audience === 'operations'
        ? `${event.rawCode} · ${formatTime(event.occurredAt)}`
        : `Actualización del ${formatTime(event.occurredAt)}`
    }
    if (reference.kind === 'shipment' && onOpenShipment && reference.id !== view.shipment.id)
      return 'Envío relacionado'
    return null
  }

  const openEvidence = (reference: EvidenceReference) => {
    const target = evidenceTargetId(reference)
    if (target) focusEvidence(target)
    else if (reference.kind === 'shipment') onOpenShipment?.(reference.id)
  }

  return (
    <section className="detail-panel incidents-panel" aria-labelledby="incidents-title">
      <div className="detail-panel-heading">
        <h3 id="incidents-title" tabIndex={-1}>
          <AlertTriangle size={18} aria-hidden="true" />
          Incidencias
        </h3>
      </div>
      <ul className="incident-list">
        {sortIncidents(view.incidents).map((incident) => {
          const leg = incident.legId ? legs.get(incident.legId) : undefined
          const evidence = incident.evidence
            .map((reference) => ({ reference, label: evidenceLabel(reference) }))
            .filter((entry): entry is { reference: EvidenceReference; label: string } =>
              Boolean(entry.label),
            )
          const evidenceDocuments = view.documents.filter((document) =>
            incident.evidence.some(
              (reference) => reference.kind === 'document' && reference.id === document.id,
            ),
          )
          const heldWithDocuments =
            incident.condition === 'active' &&
            (incident.kind === 'customs' || incident.kind === 'hold') &&
            evidenceDocuments.length > 0 &&
            evidenceDocuments.every((document) => document.state === 'available')
          const internal = audience === 'operations' && incident.condition === 'active'
          const explanation = internal ? explainIncident(view, incident, cutoffAt) : null
          const actions = view.recommendations.filter((action) => action.incidentId === incident.id)
          return (
            <li
              key={incident.id}
              className="incident-card"
              data-condition={incident.condition}
              data-severity={incident.severity}
            >
              <div className="incident-heading">
                <strong>{incidentKindLabels[incident.kind]}</strong>
                <Badge variant="secondary" className="incident-severity">
                  Severidad {severityLabels[incident.severity].toLowerCase()}
                </Badge>
                <span className="incident-condition">
                  {incident.condition === 'active' ? 'Activa' : 'Resuelta'}
                </span>
              </div>
              <dl className="incident-facts">
                <div>
                  <dt>Abierta</dt>
                  <dd>
                    <time dateTime={incident.openedAt}>{formatTime(incident.openedAt)}</time>
                  </dd>
                </div>
                {incident.clearedAt && (
                  <div>
                    <dt>Resuelta</dt>
                    <dd>
                      <time dateTime={incident.clearedAt}>{formatTime(incident.clearedAt)}</time>
                    </dd>
                  </div>
                )}
                {leg && (
                  <div>
                    <dt>Tramo</dt>
                    <dd>
                      {leg.sequence} · {modeLabels[leg.mode]}
                    </dd>
                  </div>
                )}
                {audience === 'operations' && incident.condition === 'active' && (
                  <div>
                    <dt>Atención</dt>
                    <dd>{attentionLabels[incident.attention]}</dd>
                  </div>
                )}
              </dl>
              {explanation && (
                <div className="incident-explanation">
                  <AiBadge />
                  <p>{explanation.summary}</p>
                  <p>{explanation.impact}</p>
                </div>
              )}
              {heldWithDocuments && (
                <p className="incident-note">
                  Documentación disponible. La retención sigue activa hasta la liberación.
                </p>
              )}
              {evidence.length > 0 && (
                <div className="incident-evidence">
                  <span>Evidencias</span>
                  {evidence.map(({ reference, label }) => (
                    <Button
                      key={`${reference.kind}-${reference.id}`}
                      variant="link"
                      size="xs"
                      onClick={() => openEvidence(reference)}
                    >
                      <Link2 aria-hidden="true" />
                      {label}
                    </Button>
                  ))}
                </div>
              )}
              {internal && onRecordAction && (
                <IncidentActions actions={actions} onRecord={onRecordAction} />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
