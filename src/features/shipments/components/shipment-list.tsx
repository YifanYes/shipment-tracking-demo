import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronRight, Package, Ship, Truck } from 'lucide-react'
import type { ShipmentView } from '@/domain/contracts'
import { attentionReasons } from '@/domain/attention'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { formatTime } from '@/shared/lib/format'
import {
  emptyShipmentFilters,
  filterShipments,
  modeKey,
  shipmentFilterOptions,
  sortShipments,
  type ShipmentFilters,
} from '../lib/filters'
import {
  activeIncidents,
  deliveredAt,
  etaKindLabels,
  incidentKindLabels,
  sortIncidents,
  etaValue,
  legModesLabel,
  statusLabel,
  type Audience,
} from '../lib/presentation'
import { ShipmentFilterBar } from './shipment-filters'

export const SHIPMENT_PAGE_SIZE = 25

export function ShipmentList({
  shipments,
  cutoffAt,
  audience,
  onSelect,
  onResultsChange,
}: {
  shipments: readonly ShipmentView[]
  cutoffAt: string
  audience: Audience
  onSelect: (id: string) => void
  onResultsChange?: (count: number) => void
}) {
  const [filters, setFilters] = useState<ShipmentFilters>(emptyShipmentFilters)
  const [limit, setLimit] = useState(SHIPMENT_PAGE_SIZE)
  const options = useMemo(() => shipmentFilterOptions(shipments), [shipments])
  const results = useMemo(
    () => sortShipments(filterShipments(shipments, filters, cutoffAt), cutoffAt),
    [shipments, filters, cutoffAt],
  )
  useEffect(() => onResultsChange?.(results.length), [onResultsChange, results.length])
  const updateFilters = (next: ShipmentFilters) => {
    setFilters(next)
    setLimit(SHIPMENT_PAGE_SIZE)
  }

  if (!shipments.length)
    return (
      <section className="empty-page">
        <div className="empty-icon">
          <Package size={28} aria-hidden="true" />
        </div>
        <h2>No hay envíos en tu perímetro</h2>
      </section>
    )

  const remaining = results.length - limit
  return (
    <section className="shipment-list-view" aria-label="Listado de envíos">
      <ShipmentFilterBar
        filters={filters}
        options={options}
        audience={audience}
        onChange={updateFilters}
        onClear={() => updateFilters(emptyShipmentFilters)}
      />
      {results.length ? (
        <ul className="shipment-list">
          {results.slice(0, limit).map((view) => (
            <li key={view.shipment.id}>
              <ShipmentRow
                view={view}
                cutoffAt={cutoffAt}
                audience={audience}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="shipment-list-empty" aria-live="polite">
          <p>Ningún envío coincide con los filtros</p>
          <Button variant="outline" size="sm" onClick={() => updateFilters(emptyShipmentFilters)}>
            Quitar filtros
          </Button>
        </div>
      )}
      {remaining > 0 && (
        <Button
          variant="outline"
          className="shipment-list-more"
          onClick={() => setLimit((value) => value + SHIPMENT_PAGE_SIZE)}
        >
          Mostrar {Math.min(remaining, SHIPMENT_PAGE_SIZE)} más · quedan {remaining}
        </Button>
      )}
    </section>
  )
}

function ShipmentRow({
  view,
  cutoffAt,
  audience,
  onSelect,
}: {
  view: ShipmentView
  cutoffAt: string
  audience: Audience
  onSelect: (id: string) => void
}) {
  const { shipment, projection, origin, destination, account } = view
  const delivered = projection.lifecycle === 'delivered'
  const reasons = audience === 'operations' ? rowReasons(view, cutoffAt) : []
  const ModeIcon = modeKey(view) === 'road' ? Truck : Ship
  const deliveredTime = deliveredAt(view)
  return (
    <a
      className="shipment-row"
      href={`/shipments/${encodeURIComponent(shipment.id)}`}
      data-attention={reasons.length > 0}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return
        event.preventDefault()
        onSelect(shipment.id)
      }}
    >
      <span className="shipment-symbol">
        <ModeIcon size={21} aria-hidden="true" />
      </span>
      <span className="shipment-reference">
        <strong>{shipment.reference}</strong>
        <span>{account?.name ?? 'Cuenta sin datos'}</span>
      </span>
      <span className="shipment-route">
        <strong>
          {origin?.placeLabel ?? 'Sin datos'} → {destination?.placeLabel ?? 'Sin datos'}
        </strong>
        <span>{legModesLabel(view)}</span>
      </span>
      <Badge
        variant="secondary"
        className={`shipment-status ${delivered ? 'status-delivered' : 'status-transit'}`}
      >
        {statusLabel(view, audience)}
      </Badge>
      <span className="shipment-arrival">
        <span>{delivered ? 'Entrega confirmada' : etaKindLabels[projection.eta.kind]}</span>
        <strong>
          {delivered
            ? deliveredTime
              ? formatTime(deliveredTime)
              : 'Sin fecha confirmada'
            : etaValue(projection.eta)}
        </strong>
      </span>
      {reasons.length > 0 && (
        <span className="shipment-attention">
          <AlertTriangle size={13} aria-hidden="true" />
          {reasons.join(' · ')}
        </span>
      )}
      <ChevronRight className="shipment-open-icon" size={16} aria-hidden="true" />
    </a>
  )
}

/** Name the active incidents instead of the generic reason, without saying the same twice. */
function rowReasons(view: ShipmentView, cutoffAt: string) {
  const reasons = attentionReasons(view, cutoffAt).filter(
    (reason) => reason !== 'Incidencia pendiente',
  )
  const late = reasons.some((reason) => reason.endsWith('fuera de plazo'))
  const incidents = sortIncidents(activeIncidents(view))
    .filter(({ kind }) => !(kind === 'stale' || (kind === 'delay' && late)))
    .map((incident) => incidentKindLabels[incident.kind])
  return [...new Set([...incidents, ...reasons])]
}
