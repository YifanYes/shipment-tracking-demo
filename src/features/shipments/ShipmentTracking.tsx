import { ChevronRight, Package, Truck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { LegStage } from '@/domain/contracts'
import type { ShipmentView } from '@/domain/selectors'

export const stageLabels: Record<LegStage, string> = {
  planned: 'Planificado',
  collected: 'Recogido',
  at_origin_terminal: 'En terminal de origen',
  loaded: 'Cargado',
  in_transit: 'En tránsito',
  at_destination_terminal: 'En terminal de destino',
  customs: 'En aduana',
  out_for_delivery: 'En reparto',
  completed: 'Entregado',
}

export function formatTime(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function ShipmentList({
  shipments,
  onSelect,
}: {
  shipments: readonly ShipmentView[]
  onSelect: (id: string) => void
}) {
  if (!shipments.length)
    return (
      <section className="empty-page">
        <div className="empty-icon">
          <Package size={28} />
        </div>
        <h2>No hay envíos en tu perímetro</h2>
        <p>Esta identidad no tiene envíos asignados. Cambia de identidad para recorrer la demo.</p>
      </section>
    )
  return (
    <section className="shipment-list" aria-label="Listado de envíos">
      {shipments.map(({ shipment, projection, origin, destination, account }) => (
        <a
          className="shipment-row"
          href={`/shipments/${encodeURIComponent(shipment.id)}`}
          key={shipment.id}
          onClick={(event) => {
            if (
              event.button !== 0 ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return
            event.preventDefault()
            onSelect(shipment.id)
          }}
        >
          <span className="shipment-symbol">
            <Truck size={21} />
          </span>
          <span className="shipment-reference">
            <strong>{shipment.reference}</strong>
            <span>{account?.name}</span>
          </span>
          <span className="shipment-route">
            <strong>
              {origin?.placeLabel} → {destination?.placeLabel}
            </strong>
            <span>Carretera · Nacional</span>
          </span>
          <Badge
            variant="secondary"
            className={projection.lifecycle === 'delivered' ? 'status-delivered' : 'status-transit'}
          >
            {projection.currentStage
              ? stageLabels[projection.currentStage]
              : 'Sin estado confirmado'}
          </Badge>
          <span className="shipment-arrival">
            <span>
              {projection.lifecycle === 'delivered' ? 'Entrega confirmada' : 'ETA del operador'}
            </span>
            <strong>
              {projection.lifecycle === 'delivered' && projection.lastConfirmedLocation
                ? formatTime(projection.lastConfirmedLocation.confirmedAt)
                : projection.eta.kind === 'operator'
                  ? formatTime(projection.eta.arrivalAt)
                  : 'Información insuficiente'}
            </strong>
          </span>
          <ChevronRight className="shipment-open-icon" size={16} aria-hidden="true" />
        </a>
      ))}
    </section>
  )
}
