import { CheckCheck, Package, Radio, Truck } from 'lucide-react'
import type { ShipmentView } from '@/domain/contracts'
import { formatTime } from '@/shared/lib/format'
import { AiBadge } from '@/shared/ui/ai-badge'
import { Button } from '@/shared/ui/button'
import { toastManager } from '@/shared/ui/toast'
import type { RecordAction } from './incident-actions'
import {
  formatDuration,
  operatorName,
  type Audience,
  type TimelineEntry,
} from '../lib/presentation'

export function ShipmentEvents({
  view,
  entries,
  audience,
  onRecordAction,
}: {
  view: ShipmentView
  entries: readonly TimelineEntry[]
  audience: Audience
  /** Operations only: accepts a proposed classification. */
  onRecordAction?: RecordAction
}) {
  return (
    <section className="detail-panel events-panel" aria-labelledby="events-title">
      <div className="detail-panel-heading">
        <h3 id="events-title" tabIndex={-1}>
          <Radio size={18} aria-hidden="true" />
          {audience === 'operations' ? 'Eventos del operador' : 'Actualizaciones'}
        </h3>
      </div>
      {entries.length ? (
        <ol className="event-list">
          {entries.map(({ event, title, details, known, stage, delivered }, index) => {
            const EventIcon =
              stage === 'completed'
                ? CheckCheck
                : stage === 'collected'
                  ? Package
                  : stage
                    ? Truck
                    : Radio
            const suggestion = view.recommendations.find(
              (action) => action.kind === 'classify_event' && action.eventId === event.id,
            )
            const classified = view.activity.find((record) => record.eventId === event.id)
            const receivedDelay = Math.round(
              (Date.parse(event.receivedAt) - Date.parse(event.occurredAt)) / 60_000,
            )
            return (
              <li
                key={event.id}
                id={`event-${event.id}`}
                tabIndex={-1}
                data-latest={index === 0}
                data-delivered={delivered === true}
                data-known={known}
              >
                <span className="event-marker">
                  <EventIcon size={16} aria-hidden="true" />
                </span>
                <div className="event-content">
                  <div className="event-heading">
                    <time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time>
                    {index === 0 && <span className="event-latest-label">Último evento</span>}
                  </div>
                  <h4>{classified ? `Clasificado: ${classified.subject}` : title}</h4>
                  {audience === 'operations' ? (
                    <>
                      <p className="event-message">{event.rawMessage}</p>
                      <div className="event-source">
                        <span>{operatorName(view, event.operatorId)}</span>
                        <code>{event.rawCode}</code>
                      </div>
                      {details.length > 0 && !classified && (
                        <p className="event-normalized" data-known={known}>
                          {details.join(' · ')}
                        </p>
                      )}
                      {suggestion && onRecordAction && (
                        <div className="event-suggestion">
                          <div>
                            <AiBadge label="Propuesta IA" />
                            <strong>{suggestion.subject}</strong>
                            <p>{suggestion.explanation}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onRecordAction(suggestion.id)
                              toastManager.add({
                                title: 'Código clasificado',
                                description: suggestion.message,
                                timeout: 5000,
                              })
                              document.getElementById('events-title')?.focus()
                            }}
                          >
                            Aceptar propuesta
                          </Button>
                        </div>
                      )}
                      <p className="event-received">
                        Recibido{' '}
                        <time dateTime={event.receivedAt}>{formatTime(event.receivedAt)}</time>
                        {receivedDelay >= 60 && ` · ${formatDuration(receivedDelay)} después`}
                      </p>
                    </>
                  ) : (
                    details.map((detail) => (
                      <p key={detail} className="event-message">
                        {detail}
                      </p>
                    ))
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="events-empty">Sin eventos recibidos</p>
      )}
    </section>
  )
}
