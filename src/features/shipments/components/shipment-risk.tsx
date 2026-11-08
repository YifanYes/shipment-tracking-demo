import { CloudAlert } from 'lucide-react'
import type { ShipmentView } from '@/domain/contracts'
import { assessDelayRisk } from '@/domain/risk'
import { AiBadge } from '@/shared/ui/ai-badge'
import { IncidentActions, type RecordAction } from './incident-actions'
import type { Audience } from '../lib/presentation'

const levelLabels = { medium: 'Riesgo medio de retraso', high: 'Riesgo alto de retraso' }

/** An early warning: shown apart from incidents because no operator has confirmed it. */
export function ShipmentRisk({
  view,
  audience,
  cutoffAt,
  onRecordAction,
}: {
  view: ShipmentView
  audience: Audience
  cutoffAt: string
  onRecordAction?: RecordAction
}) {
  const risk = assessDelayRisk(view, cutoffAt)
  if (!risk) {
    // Without any event there is nothing to estimate, only an operator to ask.
    const pending = view.recommendations.filter(
      (action) => action.incidentId === `no-data-${view.shipment.id}`,
    )
    if (!onRecordAction || !pending.length) return null
    return (
      <section className="detail-panel risk-panel" aria-labelledby="risk-title">
        <div className="detail-panel-heading">
          <h3 id="risk-title" tabIndex={-1}>
            <CloudAlert size={18} aria-hidden="true" />
            Sin información del operador
          </h3>
        </div>
        <IncidentActions actions={pending} onRecord={onRecordAction} />
      </section>
    )
  }
  const actions = view.recommendations.filter((action) => action.incidentId === risk.id)
  return (
    <section
      className="detail-panel risk-panel"
      data-level={risk.level}
      aria-labelledby="risk-title"
    >
      <div className="detail-panel-heading">
        <h3 id="risk-title" tabIndex={-1}>
          <CloudAlert size={18} aria-hidden="true" />
          {levelLabels[risk.level]}
          <AiBadge label="Estimación IA" />
        </h3>
      </div>
      <ul className="risk-factors">
        {risk.factors.map((factor) => (
          <li key={factor}>{factor}</li>
        ))}
      </ul>
      {audience === 'customer' && <p className="risk-note">Sin confirmar por el operador.</p>}
      {onRecordAction && <IncidentActions actions={actions} onRecord={onRecordAction} />}
    </section>
  )
}
