import { CheckCheck, ExternalLink, Package } from 'lucide-react'
import type { ShipmentView } from '@/domain/contracts'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { formatTime } from '@/shared/lib/format'
import {
  customerStatus,
  delayExplanation,
  delayMinutes,
  deliveredAt,
  etaKindLabels,
  etaValue,
  formatDuration,
  legModesLabel,
} from '@/features/shipments'
import { recentDeliveries, upcomingDeliveries } from '../lib/deliveries'

export function CustomerHome({
  shipments,
  cutoffAt,
  onOpenShipment,
}: {
  shipments: readonly ShipmentView[]
  cutoffAt: string
  onOpenShipment: (id: string) => void
}) {
  if (!shipments.length)
    return (
      <section className="empty-page">
        <div className="empty-icon">
          <Package size={28} aria-hidden="true" />
        </div>
        <h2>No hay envíos para esta cuenta</h2>
      </section>
    )
  const upcoming = upcomingDeliveries(shipments)
  const recent = recentDeliveries(shipments)

  return (
    <div className="customer-home">
      <section className="customer-section" aria-labelledby="customer-upcoming-title">
        <h2 id="customer-upcoming-title">Próximas entregas</h2>
        {upcoming.length ? (
          <ul className="customer-cards">
            {upcoming.map((view) => (
              <li key={view.shipment.id}>
                <UpcomingCard view={view} cutoffAt={cutoffAt} onOpen={onOpenShipment} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="customer-empty">No hay entregas previstas</p>
        )}
      </section>
      {recent.length > 0 && (
        <section className="customer-section" aria-labelledby="customer-recent-title">
          <h2 id="customer-recent-title">Entregas recientes</h2>
          <ul className="customer-recent">
            {recent.map((view) => (
              <li key={view.shipment.id}>
                <RecentRow view={view} cutoffAt={cutoffAt} onOpen={onOpenShipment} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function CardHeading({ view, onOpen }: { view: ShipmentView; onOpen: (id: string) => void }) {
  const { shipment, origin, destination } = view
  return (
    <div className="customer-card-heading">
      <div>
        <h3>{shipment.reference}</h3>
        <p>
          {origin?.placeLabel ?? 'Sin datos'} → {destination?.placeLabel ?? 'Sin datos'} ·{' '}
          {legModesLabel(view)}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        aria-label={`Ver detalle de ${shipment.reference}`}
        onClick={() => onOpen(shipment.id)}
      >
        Ver detalle
      </Button>
    </div>
  )
}

function UpcomingCard({
  view,
  cutoffAt,
  onOpen,
}: {
  view: ShipmentView
  cutoffAt: string
  onOpen: (id: string) => void
}) {
  const { shipment, projection } = view
  const delay = delayMinutes(view, cutoffAt)
  const late = delay !== null && delay > 0
  const reasons = late ? delayExplanation(view) : []
  return (
    <article className="customer-card" data-late={late}>
      <CardHeading view={view} onOpen={onOpen} />
      <Badge variant="secondary" className="status-transit customer-status">
        {customerStatus(view)}
      </Badge>
      <dl className="customer-dates">
        <div>
          <dt>{etaKindLabels[projection.eta.kind]}</dt>
          <dd>{etaValue(projection.eta)}</dd>
        </div>
        <div>
          <dt>Entrega comprometida</dt>
          <dd>{formatTime(shipment.committedDeliveryAt)}</dd>
        </div>
      </dl>
      {projection.eta.kind === 'unavailable' && (
        <p className="customer-note">{projection.eta.reason}</p>
      )}
      {late && (
        <div className="customer-delay">
          <strong>
            {projection.eta.kind === 'unavailable'
              ? `Fecha comprometida superada hace ${formatDuration(delay)}`
              : `Retraso previsto de ${formatDuration(delay)}`}
          </strong>
          {reasons.length > 0 && (
            <ul>
              {reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <CustomerDocuments view={view} />
    </article>
  )
}

function RecentRow({
  view,
  cutoffAt,
  onOpen,
}: {
  view: ShipmentView
  cutoffAt: string
  onOpen: (id: string) => void
}) {
  const at = deliveredAt(view)
  const delay = delayMinutes(view, cutoffAt)
  const late = delay !== null && delay > 0
  return (
    <article className="customer-card" data-late={late}>
      <CardHeading view={view} onOpen={onOpen} />
      <p className="customer-delivered">
        <CheckCheck size={13} aria-hidden="true" />
        Entregado {at ? formatTime(at) : ''}
        {delay !== null && (
          <span>
            {late ? `${formatDuration(delay)} después de lo comprometido` : 'Dentro de plazo'}
          </span>
        )}
      </p>
      <CustomerDocuments view={view} />
    </article>
  )
}

function CustomerDocuments({ view }: { view: ShipmentView }) {
  if (!view.documents.length) return null
  return (
    <ul className="customer-documents" aria-label={`Documentos de ${view.shipment.reference}`}>
      {view.documents.map((document) => (
        <li key={document.id}>
          {document.state === 'available' && document.resourcePath ? (
            <a
              href={document.resourcePath}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${document.name} (se abre en una pestaña nueva)`}
            >
              {document.name}
              <ExternalLink size={11} aria-hidden="true" />
            </a>
          ) : (
            <span data-state="missing">{document.name} · Pendiente de recibir</span>
          )}
        </li>
      ))}
    </ul>
  )
}
