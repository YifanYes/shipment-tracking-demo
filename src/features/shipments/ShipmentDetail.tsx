import { useEffect, useRef } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  MapPin,
  Package,
  Radio,
  Truck,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { ShipmentView } from '@/domain/selectors'
import { normalizeEvent } from '@/domain/tracking'
import { formatTime, stageLabels } from './ShipmentTracking'

export function ShipmentDetail({ item, onBack }: { item: ShipmentView; onBack: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { shipment, projection, events, origin, destination, operators, locations, account } = item
  const eta = projection.eta
  const delivered = projection.lifecycle === 'delivered'
  const status = projection.currentStage
    ? stageLabels[projection.currentStage]
    : 'Sin estado confirmado'
  const location = locations.find(
    (entry) => entry.id === projection.lastConfirmedLocation?.locationId,
  )
  const locationEvent = events.find(
    (event) => event.id === projection.lastConfirmedLocation?.evidence.id,
  )
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section className="shipment-detail" aria-labelledby="detail-title">
      <nav className="detail-breadcrumb" aria-label="Ruta de navegación">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} />
          Volver a envíos
        </Button>
        <ChevronRight size={13} aria-hidden="true" />
        <span aria-current="page">{shipment.reference}</span>
      </nav>

      <div className="detail-heading">
        <div className="detail-identity">
          <div className="detail-shipment-icon">
            <Truck size={25} aria-hidden="true" />
          </div>
          <div>
            <p className="detail-eyebrow">{account?.name ?? 'Cuenta sin datos'}</p>
            <h2 id="detail-title" tabIndex={-1} ref={headingRef}>
              {shipment.reference}
            </h2>
            <p>
              {shipment.legs
                .map((leg) => (leg.mode === 'road' ? 'Carretera' : 'Mar'))
                .filter((mode, index, modes) => modes.indexOf(mode) === index)
                .join(' + ')}{' '}
              · {operators.map((operator) => operator.name).join(', ')}
            </p>
          </div>
        </div>
        <div className="detail-status" aria-live="polite">
          <Badge variant="secondary" className={delivered ? 'status-delivered' : 'status-transit'}>
            {delivered ? <CheckCheck size={13} /> : <Truck size={13} />}
            {status}
          </Badge>
          <span>
            <span className="freshness-dot" data-current={projection.freshness === 'current'} />
            {projection.freshness === 'current'
              ? 'Información al día'
              : projection.freshness === 'stale'
                ? 'Información desactualizada'
                : 'Sin actualizaciones'}
          </span>
        </div>
      </div>

      <div className="detail-facts" aria-live="polite">
        <div className="detail-fact" data-tone="blue">
          <div className="detail-fact-label">
            <Clock3 size={16} />
            <span>{delivered ? 'Última ETA comunicada' : 'ETA del operador'}</span>
          </div>
          <strong>
            {eta.kind === 'operator'
              ? formatTime(eta.arrivalAt)
              : eta.kind === 'estimate'
                ? `${formatTime(eta.earliestAt)} a ${formatTime(eta.latestAt)}`
                : 'Información insuficiente'}
          </strong>
          <p>
            {eta.kind === 'operator'
              ? `${operators.find((operator) => operator.id === eta.operatorId)?.name ?? 'Operador'} · Emitida ${formatTime(eta.issuedAt)}`
              : eta.kind === 'unavailable'
                ? eta.reason
                : `Estimación · Emitida ${formatTime(eta.issuedAt)}`}
          </p>
        </div>
        <div className="detail-fact" data-tone="neutral">
          <div className="detail-fact-label">
            <CalendarDays size={16} />
            <span>Entrega comprometida</span>
          </div>
          <strong>{formatTime(shipment.committedDeliveryAt)}</strong>
          <p>Fecha acordada para este envío</p>
        </div>
        <div className="detail-fact" data-tone="green">
          <div className="detail-fact-label">
            <MapPin size={16} />
            <span>Última ubicación confirmada</span>
          </div>
          <strong>{location?.name ?? 'Sin ubicación confirmada'}</strong>
          <p>
            {projection.lastConfirmedLocation
              ? `${formatTime(projection.lastConfirmedLocation.confirmedAt)} · ${operators.find((operator) => operator.id === locationEvent?.operatorId)?.name ?? 'Operador'}`
              : 'Sin evidencia disponible'}
          </p>
        </div>
      </div>

      <div className="detail-body">
        <section className="detail-panel journey-panel" aria-labelledby="journey-title">
          <div className="detail-panel-heading">
            <div>
              <h3 id="journey-title">
                <Truck size={18} aria-hidden="true" />
                Recorrido del envío
              </h3>
              <p>
                {shipment.legs.length} {shipment.legs.length === 1 ? 'tramo' : 'tramos'} ·{' '}
                {operators.map((operator) => operator.name).join(', ')}
              </p>
            </div>
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
          {shipment.legs.map((leg) => (
            <div className="journey-leg" key={leg.id}>
              {shipment.legs.length > 1 && (
                <h4>
                  Tramo {leg.sequence} · {leg.mode === 'road' ? 'Carretera' : 'Mar'}
                </h4>
              )}
              <ol className="milestone-list">
                {leg.milestones.map((stage) => {
                  const confirmed = events.some((event) => {
                    const normalized = normalizeEvent(event)
                    return (
                      event.legId === leg.id &&
                      normalized.mapping === 'known' &&
                      normalized.signals.some(
                        (signal) => signal.kind === 'progress' && signal.stage === stage,
                      )
                    )
                  })
                  const current =
                    projection.currentLegId === leg.id && projection.currentStage === stage
                  return (
                    <li
                      key={stage}
                      data-confirmed={confirmed}
                      aria-current={current ? 'step' : undefined}
                    >
                      <span className="milestone-dot">
                        {confirmed ? <Check size={12} /> : <span />}
                      </span>
                      <div>
                        <strong>{stageLabels[stage]}</strong>
                        <small>
                          {confirmed
                            ? current
                              ? 'Último estado confirmado'
                              : 'Confirmado por el operador'
                            : stage === 'planned'
                              ? 'Plan del envío'
                              : 'Sin confirmación individual'}
                        </small>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          ))}
        </section>

        <section className="detail-panel events-panel" aria-labelledby="events-title">
          <div className="detail-panel-heading">
            <div>
              <h3 id="events-title">
                <Radio size={18} aria-hidden="true" />
                Eventos del operador
              </h3>
              <p>
                {events.length} {events.length === 1 ? 'evento' : 'eventos'} · Más reciente primero
              </p>
            </div>
          </div>
          {events.length ? (
            <ol className="event-list">
              {[...events].reverse().map((event, index) => {
                const normalized = normalizeEvent(event)
                const stage =
                  normalized.mapping === 'known'
                    ? normalized.signals.find((signal) => signal.kind === 'progress')?.stage
                    : undefined
                const EventIcon =
                  stage === 'completed'
                    ? CheckCheck
                    : stage === 'collected'
                      ? Package
                      : stage
                        ? Truck
                        : Radio
                return (
                  <li
                    key={event.id}
                    data-latest={index === 0}
                    data-delivered={stage === 'completed'}
                  >
                    <span className="event-marker">
                      <EventIcon size={16} aria-hidden="true" />
                    </span>
                    <div className="event-content">
                      <div className="event-heading">
                        <time dateTime={event.occurredAt}>{formatTime(event.occurredAt)}</time>
                        {index === 0 && <span className="event-latest-label">Último evento</span>}
                      </div>
                      <h4>{stage ? stageLabels[stage] : 'Pendiente de clasificación'}</h4>
                      <p className="event-message">{event.rawMessage}</p>
                      <div className="event-source">
                        <span>
                          {operators.find((operator) => operator.id === event.operatorId)?.name ??
                            'Operador'}
                        </span>
                        <code>{event.rawCode}</code>
                      </div>
                      <p className="event-received">
                        Recibido{' '}
                        <time dateTime={event.receivedAt}>{formatTime(event.receivedAt)}</time>
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <p className="events-empty">Todavía no hay eventos recibidos para este envío.</p>
          )}
        </section>
      </div>
    </section>
  )
}
