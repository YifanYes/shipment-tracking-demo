import { useEffect, useMemo, useRef } from 'react'
import { ArrowLeft, CalendarDays, CheckCheck, Clock3, MapPin, Ship, Truck } from 'lucide-react'
import type { ShipmentView } from '@/domain/contracts'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { formatTime, updateAge } from '@/shared/lib/format'
import { modeKey } from '../lib/filters'
import {
  delayExplanation,
  delayMinutes,
  deliveredAt,
  etaKindLabels,
  etaValue,
  formatDuration,
  freshnessLabels,
  legModesLabel,
  locationName,
  operatorName,
  statusLabel,
  timelineEntries,
  type Audience,
} from '../lib/presentation'
import { ShipmentActivity } from './shipment-activity'
import { ShipmentDocuments } from './shipment-documents'
import type { RecordAction } from './incident-actions'
import { ShipmentEvents } from './shipment-events'
import { ShipmentIncidents } from './shipment-incidents'
import { ShipmentJourney } from './shipment-journey'

export function ShipmentDetail({
  item,
  cutoffAt,
  audience,
  backLabel = 'Volver a envíos',
  onBack,
  onOpenShipment,
  onRecordAction,
  actorName = (id) => id,
}: {
  item: ShipmentView
  cutoffAt: string
  audience: Audience
  backLabel?: string
  onBack: () => void
  onOpenShipment?: (id: string) => void
  onRecordAction?: RecordAction
  actorName?: (identityId: string) => string
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { shipment, projection, operators, account } = item
  const delivered = projection.lifecycle === 'delivered'
  const entries = useMemo(() => timelineEntries(item, audience), [item, audience])
  const visibleEventIds = useMemo(() => new Set(entries.map((entry) => entry.event.id)), [entries])
  const ModeIcon = modeKey(item) === 'road' ? Truck : Ship

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section className="shipment-detail" aria-labelledby="detail-title">
      <nav className="detail-breadcrumb" aria-label="Ruta de navegación">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} aria-hidden="true" />
          {backLabel}
        </Button>
      </nav>

      <div className="detail-heading">
        <div className="detail-identity">
          <div className="detail-shipment-icon">
            <ModeIcon size={25} aria-hidden="true" />
          </div>
          <div>
            <p className="detail-eyebrow">{account?.name ?? 'Cuenta sin datos'}</p>
            <h2 id="detail-title" tabIndex={-1} ref={headingRef}>
              {shipment.reference}
            </h2>
            <p>
              {legModesLabel(item)} · {operators.map((operator) => operator.name).join(', ')}
            </p>
          </div>
        </div>
        <div className="detail-status" aria-live="polite">
          <Badge variant="secondary" className={delivered ? 'status-delivered' : 'status-transit'}>
            {delivered ? (
              <CheckCheck size={13} aria-hidden="true" />
            ) : (
              <ModeIcon size={13} aria-hidden="true" />
            )}
            {statusLabel(item, audience)}
          </Badge>
          <span>
            <span className="freshness-dot" data-current={projection.freshness === 'current'} />
            {freshnessLabels[projection.freshness]}
          </span>
        </div>
      </div>

      <div className="detail-facts" aria-live="polite">
        <ArrivalFact item={item} cutoffAt={cutoffAt} />
        <div className="detail-fact" data-tone="neutral">
          <div className="detail-fact-label">
            <CalendarDays size={16} aria-hidden="true" />
            <span>Entrega comprometida</span>
          </div>
          <strong>{formatTime(shipment.committedDeliveryAt)}</strong>
        </div>
        <div className="detail-fact" data-tone="green">
          <div className="detail-fact-label">
            <MapPin size={16} aria-hidden="true" />
            <span>Última ubicación confirmada</span>
          </div>
          {projection.lastConfirmedLocation ? (
            <>
              <strong>{locationName(item, projection.lastConfirmedLocation.locationId)}</strong>
              <p>
                {formatTime(projection.lastConfirmedLocation.confirmedAt)} ·{' '}
                {operatorName(
                  item,
                  item.events.find(
                    (event) => event.id === projection.lastConfirmedLocation?.evidence.id,
                  )?.operatorId,
                )}
              </p>
              {!delivered && (
                <p>{updateAge(projection.lastConfirmedLocation.confirmedAt, cutoffAt)}</p>
              )}
            </>
          ) : (
            <strong>Sin ubicación confirmada</strong>
          )}
        </div>
      </div>

      <ShipmentIncidents
        view={item}
        audience={audience}
        visibleEventIds={visibleEventIds}
        cutoffAt={cutoffAt}
        onOpenShipment={onOpenShipment}
        onRecordAction={audience === 'operations' ? onRecordAction : undefined}
      />

      <div className="detail-body">
        <div className="detail-column">
          <ShipmentJourney view={item} />
          <ShipmentDocuments documents={item.documents} />
          <ShipmentActivity view={item} audience={audience} actorName={actorName} />
        </div>
        <ShipmentEvents view={item} entries={entries} audience={audience} />
      </div>
    </section>
  )
}

function ArrivalFact({ item, cutoffAt }: { item: ShipmentView; cutoffAt: string }) {
  const { projection } = item
  const eta = projection.eta
  const delay = delayMinutes(item, cutoffAt)
  const late = delay !== null && delay > 0
  const reasons = late ? delayExplanation(item) : []

  if (projection.lifecycle === 'delivered') {
    const at = deliveredAt(item)
    return (
      <div className="detail-fact" data-tone="blue">
        <div className="detail-fact-label">
          <CheckCheck size={16} aria-hidden="true" />
          <span>Entrega confirmada</span>
        </div>
        <strong>{at ? formatTime(at) : 'Sin fecha confirmada'}</strong>
        {delay !== null && (
          <p data-late={late}>
            {late ? `${formatDuration(delay)} después de lo comprometido` : 'Dentro de plazo'}
          </p>
        )}
        <DelayReasons reasons={reasons} />
      </div>
    )
  }

  return (
    <div className="detail-fact" data-tone="blue">
      <div className="detail-fact-label">
        <Clock3 size={16} aria-hidden="true" />
        <span>{etaKindLabels[eta.kind]}</span>
      </div>
      <strong>{etaValue(eta)}</strong>
      {eta.kind === 'operator' && (
        <p>
          {operatorName(item, eta.operatorId)} · Emitida {formatTime(eta.issuedAt)}
        </p>
      )}
      {eta.kind === 'estimate' && (
        <>
          <p>Emitida {formatTime(eta.issuedAt)}</p>
          {eta.assumptions.length > 0 && (
            <ul className="fact-list" aria-label="Supuestos de la estimación">
              {eta.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {eta.kind === 'unavailable' && <p>{eta.reason}</p>}
      {late && (
        <p data-late="true">
          {eta.kind === 'unavailable'
            ? `Fecha comprometida superada hace ${formatDuration(delay)}`
            : `${formatDuration(delay)} después de lo comprometido`}
        </p>
      )}
      <DelayReasons reasons={reasons} />
    </div>
  )
}

function DelayReasons({ reasons }: { reasons: readonly string[] }) {
  if (!reasons.length) return null
  return (
    <ul className="fact-list" aria-label="Motivos del retraso">
      {reasons.map((reason) => (
        <li key={reason}>{reason}</li>
      ))}
    </ul>
  )
}
