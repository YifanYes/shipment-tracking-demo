import { ArrowRight, Check, Route } from 'lucide-react'
import type { LegStage, ShipmentView } from '@/domain/contracts'
import { locationName, modeLabels, operatorName, sortedLegs, stageLabel } from '../lib/presentation'

type LegState = 'done' | 'current' | 'pending'

const legStateLabels: Record<LegState, string> = {
  done: 'Completado',
  current: 'En curso',
  pending: 'Pendiente',
}

export function ShipmentJourney({ view }: { view: ShipmentView }) {
  const { projection, origin, destination } = view
  const legs = sortedLegs(view)
  const stageOf = (legId: string): LegStage => projection.legStages[legId] ?? 'planned'
  const legState = (legId: string): LegState =>
    stageOf(legId) === 'completed'
      ? 'done'
      : projection.lifecycle !== 'delivered' && projection.currentLegId === legId
        ? 'current'
        : 'pending'

  return (
    <section className="detail-panel journey-panel" aria-labelledby="journey-title">
      <div className="detail-panel-heading">
        <h3 id="journey-title">
          <Route size={18} aria-hidden="true" />
          Recorrido
        </h3>
      </div>
      <div className="journey-endpoints">
        <div>
          <span>Origen</span>
          <strong>{origin?.placeLabel ?? 'Sin datos'}</strong>
          <p>{origin?.name}</p>
        </div>
        <ArrowRight size={18} aria-hidden="true" />
        <div>
          <span>Destino</span>
          <strong>{destination?.placeLabel ?? 'Sin datos'}</strong>
          <p>{destination?.name}</p>
        </div>
      </div>
      <ol className="journey-legs">
        {legs.map((leg) => {
          const state = legState(leg.id)
          const confirmedIndex = leg.milestones.indexOf(stageOf(leg.id))
          return (
            <li
              key={leg.id}
              className="journey-leg"
              data-state={state}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <div className="journey-leg-heading">
                <h4>
                  Tramo {leg.sequence} · {modeLabels[leg.mode]}
                </h4>
                <span>{legStateLabels[state]}</span>
              </div>
              <p className="journey-leg-route">
                {locationName(view, leg.originLocationId)} →{' '}
                {locationName(view, leg.destinationLocationId)}
              </p>
              <p className="journey-leg-operator">{operatorName(view, leg.operatorId)}</p>
              {state === 'current' && (
                <ol className="milestone-list" aria-label={`Hitos del tramo ${leg.sequence}`}>
                  {leg.milestones.map((stage, index) => {
                    const confirmed = index <= confirmedIndex
                    const latest = index === confirmedIndex
                    return (
                      <li
                        key={stage}
                        data-confirmed={confirmed}
                        aria-current={latest ? 'step' : undefined}
                      >
                        <span className="milestone-dot">
                          {confirmed ? <Check size={12} aria-hidden="true" /> : <span />}
                        </span>
                        <div>
                          <strong>{stageLabel(stage, leg.id === legs.at(-1)?.id)}</strong>
                          {latest && stage !== 'planned' && <small>Último hito confirmado</small>}
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </li>
          )
        })}
      </ol>
    </section>
  )
}
