import { lazy, Suspense, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  LocateFixed,
  Package,
  Ship,
  ShieldCheck,
  Truck,
  X,
} from 'lucide-react'
import type { ShipmentView } from '@/domain/contracts'
import { attentionReasons } from '@/domain/attention'
import { formatTime, stageLabels, updateAge } from '@/shared/lib/format'
import { confirmedLocation, hasCoordinates, mapTone } from '../lib/map-data'

const LogisticsMap = lazy(() => import('./logistics-map'))

interface Props {
  shipments: readonly ShipmentView[]
  cutoffAt: string
  onOpenShipment: (id: string) => void
}

export function ShipmentOverview({ shipments, cutoffAt, onOpenShipment }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clusterIds, setClusterIds] = useState<string[] | null>(null)
  const visible = shipments.filter((item) => item.projection.lifecycle !== 'delivered')
  const selected = visible.find((item) => item.shipment.id === selectedId) ?? null
  const attention = shipments.filter((item) => attentionReasons(item, cutoffAt).length)
  const list = clusterIds
    ? visible.filter((item) => clusterIds.includes(item.shipment.id))
    : visible
  const focusShipment = (id: string) => {
    const item = shipments.find((entry) => entry.shipment.id === id)
    if (!item) return
    if (item.projection.lifecycle === 'delivered') {
      onOpenShipment(id)
      return
    }
    setSelectedId(id)
    setClusterIds(null)
  }

  return (
    <div className="overview-grid">
      <section className="network-panel" aria-labelledby="network-title">
        <div className="panel-heading map-heading">
          <h2 id="network-title">Envíos en curso</h2>
          <span className="map-shipment-count">{visible.length}</span>
        </div>
        <div className="map-surface">
          <div className="logistics-map-frame">
            <Suspense fallback={<output className="map-loading">Cargando mapa…</output>}>
              <LogisticsMap
                shipments={visible}
                selected={selected}
                cutoffAt={cutoffAt}
                onSelect={focusShipment}
                onClusterSelect={setClusterIds}
              />
            </Suspense>
            {!visible.length && (
              <div className="map-empty">
                <span className="map-empty-icon">
                  {shipments.length ? <Check size={23} /> : <Package size={23} />}
                </span>
                <strong>{shipments.length ? 'Sin envíos en curso' : 'Sin envíos asignados'}</strong>
              </div>
            )}
          </div>
          <div className="map-legend">
            <span>
              <i data-tone="transit" /> En curso
            </span>
            <span>
              <i data-tone="attention" /> Atención
            </span>
            {visible.some((item) => mapTone(item, cutoffAt) === 'unknown') && (
              <span>
                <i data-tone="unknown" /> Pendiente de salida
              </span>
            )}
          </div>
        </div>

        {selected && (
          <SelectedShipment
            item={selected}
            cutoffAt={cutoffAt}
            onOpen={() => onOpenShipment(selected.shipment.id)}
            onClose={() => setSelectedId(null)}
          />
        )}

        {list.length > 0 && (
          <div className="map-shipment-list" aria-label="Envíos del mapa">
            {clusterIds && (
              <div className="map-list-heading">
                <span>{list.length} envíos en esta zona</span>
                <button type="button" onClick={() => setClusterIds(null)}>
                  Ver todos
                </button>
              </div>
            )}
            {list.map((item) => {
              const location = confirmedLocation(item)
              const mode = item.shipment.legs.find(
                (leg) => leg.id === item.projection.currentLegId,
              )?.mode
              const Icon = mode === 'sea' ? Ship : Truck
              return (
                <button
                  key={item.shipment.id}
                  className="map-shipment-row"
                  type="button"
                  aria-pressed={selected?.shipment.id === item.shipment.id}
                  onClick={() => focusShipment(item.shipment.id)}
                >
                  <span className="map-row-icon" data-tone={mapTone(item, cutoffAt)}>
                    <Icon size={17} aria-hidden="true" />
                  </span>
                  <span className="map-row-reference">
                    <strong>{item.shipment.reference}</strong>
                    <span>
                      {item.origin?.placeLabel ?? 'Origen pendiente'}{' '}
                      <ArrowRight size={11} aria-hidden="true" />{' '}
                      {item.destination?.placeLabel ?? 'Destino pendiente'}
                    </span>
                  </span>
                  <span className="map-row-location">
                    <strong>{location?.placeLabel ?? 'Sin ubicación confirmada'}</strong>
                    <span>
                      {hasCoordinates(location)
                        ? updateAge(item.projection.lastConfirmedLocation?.confirmedAt, cutoffAt)
                        : 'Sin coordenadas disponibles'}
                    </span>
                  </span>
                  <ChevronRight size={15} aria-hidden="true" />
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="attention-panel" aria-labelledby="attention-title">
        <div className="panel-heading">
          <div>
            <h2 id="attention-title">Necesita tu atención</h2>
            <p>Lo que conviene revisar primero</p>
          </div>
          <span className="attention-count">{attention.length}</span>
        </div>
        {attention.length ? (
          <div className="attention-list">
            {attention.map((item) => (
              <button
                type="button"
                key={item.shipment.id}
                className="attention-item"
                aria-pressed={selected?.shipment.id === item.shipment.id}
                onClick={() => focusShipment(item.shipment.id)}
              >
                <span className="attention-item-heading">
                  <strong>{item.shipment.reference}</strong>
                  <AlertTriangle size={15} aria-hidden="true" />
                </span>
                <span>
                  {item.origin?.placeLabel} → {item.destination?.placeLabel}
                </span>
                <ul>
                  {attentionReasons(item, cutoffAt).map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <span className="attention-item-action">
                  Localizar envío <ArrowRight size={13} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-attention">
            <div className="empty-icon">
              <ShieldCheck size={28} />
            </div>
            <h3>{shipments.length ? 'Todo va según lo previsto' : 'Sin envíos asignados'}</h3>
            <p>
              {shipments.length
                ? 'No hay incidencias ni información pendiente de revisar en tu cartera.'
                : 'Esta cuenta todavía no tiene envíos.'}
            </p>
          </div>
        )}
        <div className="map-attention-note">
          <LocateFixed size={17} aria-hidden="true" />
          <p>
            Selecciona un envío para consultar su recorrido, llegada prevista y última
            actualización.
          </p>
        </div>
      </section>
    </div>
  )
}

function SelectedShipment({
  item,
  cutoffAt,
  onOpen,
  onClose,
}: {
  item: ShipmentView
  cutoffAt: string
  onOpen: () => void
  onClose: () => void
}) {
  const location = confirmedLocation(item)
  const delivered = item.projection.lifecycle === 'delivered'
  const eta = item.projection.eta
  return (
    <section className="map-selected" aria-label={`Resumen de ${item.shipment.reference}`}>
      <div className="map-selected-heading">
        <strong>{item.shipment.reference}</strong>
        <span className="map-status" data-tone={mapTone(item, cutoffAt)}>
          {item.projection.currentStage
            ? stageLabels[item.projection.currentStage]
            : 'Sin estado confirmado'}
        </span>
        <button type="button" aria-label="Cerrar selección del mapa" onClick={onClose}>
          <X size={15} />
        </button>
      </div>
      <p className="map-selected-route">
        {item.shipment.legs
          .slice()
          .sort((a, b) => a.sequence - b.sequence)
          .map((leg, index) => (
            <span key={leg.id}>
              {index === 0 && (
                <>
                  {item.locations.find((entry) => entry.id === leg.originLocationId)?.placeLabel ??
                    'Origen'}{' '}
                  <ArrowRight size={12} aria-hidden="true" />{' '}
                </>
              )}
              {leg.mode === 'sea' ? (
                <Ship size={14} aria-label="Marítimo" />
              ) : (
                <Truck size={14} aria-label="Carretera" />
              )}{' '}
              {item.locations.find((entry) => entry.id === leg.destinationLocationId)?.placeLabel ??
                'Destino'}
              {index < item.shipment.legs.length - 1 && <ArrowRight size={12} aria-hidden="true" />}
            </span>
          ))}
      </p>
      <dl className="map-selected-facts">
        <div>
          <dt>Última ubicación confirmada</dt>
          <dd>{location?.name ?? 'Sin ubicación confirmada'}</dd>
          <small>{updateAge(item.projection.lastConfirmedLocation?.confirmedAt, cutoffAt)}</small>
          {item.projection.lastConfirmedLocation && (
            <time dateTime={item.projection.lastConfirmedLocation.confirmedAt}>
              {formatTime(item.projection.lastConfirmedLocation.confirmedAt)}
            </time>
          )}
        </div>
        <div>
          <dt>{delivered ? 'Entrega confirmada' : 'Llegada prevista'}</dt>
          <dd>
            {delivered && item.projection.lastConfirmedLocation
              ? formatTime(item.projection.lastConfirmedLocation.confirmedAt)
              : eta.kind === 'operator'
                ? formatTime(eta.arrivalAt)
                : eta.kind === 'estimate'
                  ? `${formatTime(eta.earliestAt)} – ${formatTime(eta.latestAt)}`
                  : 'Sin previsión disponible'}
          </dd>
          <small>
            {delivered
              ? 'Confirmada por el operador'
              : eta.kind === 'operator'
                ? `Comunicada por ${item.operators.find((operator) => operator.id === eta.operatorId)?.name ?? 'el operador'}`
                : eta.kind === 'estimate'
                  ? 'Intervalo estimado'
                  : 'Pendiente del operador'}
          </small>
        </div>
      </dl>
      <div className="map-selected-footer">
        <button type="button" onClick={onOpen}>
          Abrir detalle <ArrowRight size={14} />
        </button>
      </div>
    </section>
  )
}
