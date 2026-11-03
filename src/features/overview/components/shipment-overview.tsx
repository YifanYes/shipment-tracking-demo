import { lazy, Suspense, useMemo, useState } from 'react'
import {
  Anchor,
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronRight,
  Flag,
  Package,
  Ship,
  ShieldCheck,
  Truck,
  Warehouse,
  X,
} from 'lucide-react'
import type { ShipmentView } from '@/domain/contracts'
import { formatTime, stageLabels, updateAge } from '@/shared/lib/format'
import {
  activeIncidents,
  attentionLines,
  attentionQueue,
  attentionStateLabels,
  severityLabels,
  incidentKindLabels,
} from '../lib/attention'
import {
  type LegState,
  confirmedLocation,
  currentLeg,
  hasCoordinates,
  legRoute,
  legState,
  mapTone,
  sortedLegs,
} from '../lib/map-data'
import { networkSites, shipmentsAtSite, siteKindLabels } from '../lib/network'

const LogisticsMap = lazy(() => import('./logistics-map'))

const modeLabels = { road: 'Carretera', sea: 'Marítimo' }
const legStateLabels: Record<LegState, string> = {
  completed: 'completado',
  active: 'en curso',
  pending: 'pendiente',
}
const siteIcons = { site: Warehouse, port: Anchor, destination: Flag }

interface Props {
  shipments: readonly ShipmentView[]
  cutoffAt: string
  onOpenShipment: (id: string) => void
}

export function ShipmentOverview({ shipments, cutoffAt, onOpenShipment }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clusterIds, setClusterIds] = useState<string[] | null>(null)
  const [siteId, setSiteId] = useState<string | null>(null)
  const visible = useMemo(
    () => shipments.filter((item) => item.projection.lifecycle !== 'delivered'),
    [shipments],
  )
  const sites = useMemo(() => networkSites(visible), [visible])
  const attention = useMemo(() => attentionQueue(shipments, cutoffAt), [shipments, cutoffAt])
  const selected = visible.find((item) => item.shipment.id === selectedId) ?? null
  const site = sites.find((entry) => entry.id === siteId) ?? null
  const list = clusterIds
    ? visible.filter((item) => clusterIds.includes(item.shipment.id))
    : site
      ? shipmentsAtSite(visible, site.id)
      : visible
  const modes = new Set(
    visible.flatMap((item) => item.shipment.legs.filter(legRoute).map((leg) => leg.mode)),
  )
  const hasCompletedLeg = visible.some(
    (item) =>
      item.projection.lifecycle === 'active' &&
      item.shipment.legs.some((leg) => legState(item, leg) === 'completed' && legRoute(leg)),
  )
  const siteKinds = new Set(sites.map((entry) => entry.kind))

  const focusShipment = (id: string) => {
    const item = shipments.find((entry) => entry.shipment.id === id)
    if (!item) return
    if (item.projection.lifecycle === 'delivered') {
      onOpenShipment(id)
      return
    }
    setSelectedId(id)
    setClusterIds(null)
    if (site && !site.shipmentIds.includes(id)) setSiteId(null)
  }
  const selectSite = (id: string | null) => {
    setSiteId(id)
    setClusterIds(null)
  }
  const selectCluster = (ids: string[]) => {
    setClusterIds(ids)
    setSiteId(null)
  }
  const clearFilter = () => {
    setClusterIds(null)
    setSiteId(null)
  }

  return (
    <div className="overview-grid">
      <section className="network-panel" aria-labelledby="network-title">
        <div className="panel-heading map-heading">
          <h2 id="network-title">Envíos sin entregar</h2>
          <span className="map-shipment-count">{visible.length}</span>
        </div>
        <div className="map-surface">
          <div className="logistics-map-frame">
            <Suspense fallback={<output className="map-loading">Cargando mapa…</output>}>
              <LogisticsMap
                shipments={visible}
                sites={sites}
                selected={selected}
                selectedSiteId={site?.id ?? null}
                cutoffAt={cutoffAt}
                onSelect={focusShipment}
                onSiteSelect={selectSite}
                onClusterSelect={selectCluster}
              />
            </Suspense>
            {!visible.length && (
              <div className="map-empty">
                <span className="map-empty-icon">
                  {shipments.length ? <Check size={23} /> : <Package size={23} />}
                </span>
                <strong>
                  {shipments.length ? 'Sin envíos pendientes de entrega' : 'Sin envíos asignados'}
                </strong>
              </div>
            )}
          </div>
          {visible.length > 0 && (
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
              {[...modes].sort().map((mode) => (
                <span key={mode}>
                  <i className="legend-line" data-mode={mode} /> {modeLabels[mode]}
                </span>
              ))}
              {hasCompletedLeg && (
                <span>
                  <i className="legend-line" data-state="completed" /> Tramo completado
                </span>
              )}
              {(['site', 'port', 'destination'] as const)
                .filter((kind) => siteKinds.has(kind))
                .map((kind) => {
                  const Icon = siteIcons[kind]
                  return (
                    <span key={kind}>
                      <i className="legend-site" data-kind={kind}>
                        <Icon size={9} aria-hidden="true" />
                      </i>{' '}
                      {siteKindLabels[kind]}
                    </span>
                  )
                })}
            </div>
          )}
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
            {(clusterIds || site) && (
              <div className="map-list-heading">
                <span>
                  {site ? `${siteKindLabels[site.kind]} · ${site.name}` : 'Zona del mapa'}
                </span>
                <button type="button" onClick={clearFilter}>
                  Ver todos
                </button>
              </div>
            )}
            {list.map((item) => {
              const location = confirmedLocation(item)
              const Icon = currentLeg(item)?.mode === 'sea' ? Ship : Truck
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
          <h2 id="attention-title">Necesita tu atención</h2>
          <span className="attention-count">{attention.length}</span>
        </div>
        {attention.length ? (
          <div className="attention-list">
            {attention.map((item) => {
              const lines = attentionLines(item, cutoffAt)
              return (
                <button
                  type="button"
                  key={item.shipment.id}
                  className="attention-item"
                  data-severity={lines[0]?.severity}
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
                    {lines.map((line) => (
                      <li key={line.key} data-severity={line.severity}>
                        {line.label}
                        {line.severity && ` · ${severityLabels[line.severity]}`}
                        {line.attention &&
                          line.attention !== 'unreviewed' &&
                          ` · ${attentionStateLabels[line.attention]}`}
                      </li>
                    ))}
                  </ul>
                  <span className="attention-item-action">
                    Localizar envío <ArrowRight size={13} aria-hidden="true" />
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="empty-attention">
            <div className="empty-icon">
              <ShieldCheck size={28} />
            </div>
            <h3>{shipments.length ? 'Nada pendiente de revisar' : 'Sin envíos asignados'}</h3>
          </div>
        )}
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
  const confirmed = item.projection.lastConfirmedLocation
  const delivered = item.projection.lifecycle === 'delivered'
  const eta = item.projection.eta
  const incidents = activeIncidents(item)
  const placeOf = (id: string) => item.locations.find((entry) => entry.id === id)?.placeLabel
  const operatorName = (id: string | undefined) =>
    item.operators.find((operator) => operator.id === id)?.name
  const source =
    confirmed?.evidence.kind === 'operator_event'
      ? operatorName(item.events.find((event) => event.id === confirmed.evidence.id)?.operatorId)
      : undefined
  const legs = sortedLegs(item)
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
      <ol className="map-selected-route" aria-label="Recorrido">
        <li>{placeOf(legs[0]?.originLocationId ?? '') ?? item.origin?.placeLabel ?? 'Origen'}</li>
        {legs.map((leg) => {
          const state = legState(item, leg)
          const Icon = leg.mode === 'sea' ? Ship : Truck
          return (
            <li key={leg.id} data-state={state}>
              <span className="map-leg-mode" aria-hidden="true">
                <Icon size={13} />
              </span>
              <span className="sr-only">
                {modeLabels[leg.mode]}, {legStateLabels[state]}:{' '}
              </span>
              {placeOf(leg.destinationLocationId) ?? 'Destino'}
            </li>
          )
        })}
      </ol>
      <dl className="map-selected-facts">
        <div>
          <dt>Última ubicación confirmada</dt>
          <dd>{location?.name ?? 'Sin ubicación confirmada'}</dd>
          {confirmed && (
            <>
              <small>
                {source && `${source} · `}
                {updateAge(confirmed.confirmedAt, cutoffAt)}
              </small>
              <time dateTime={confirmed.confirmedAt}>{formatTime(confirmed.confirmedAt)}</time>
            </>
          )}
        </div>
        <div>
          <dt>{delivered ? 'Entrega confirmada' : 'Llegada prevista'}</dt>
          <dd>
            {delivered && confirmed
              ? formatTime(confirmed.confirmedAt)
              : eta.kind === 'operator'
                ? formatTime(eta.arrivalAt)
                : eta.kind === 'estimate'
                  ? `${formatTime(eta.earliestAt)} – ${formatTime(eta.latestAt)}`
                  : 'Sin previsión'}
          </dd>
          <small>
            {delivered
              ? 'Confirmada por el operador'
              : eta.kind === 'operator'
                ? `Comunicada por ${operatorName(eta.operatorId) ?? 'el operador'}`
                : eta.kind === 'estimate'
                  ? 'Intervalo estimado'
                  : eta.reason}
          </small>
        </div>
        <div>
          <dt>Fecha comprometida</dt>
          <dd>
            <time dateTime={item.shipment.committedDeliveryAt}>
              {formatTime(item.shipment.committedDeliveryAt)}
            </time>
          </dd>
        </div>
        {incidents.length > 0 && (
          <div className="map-selected-incidents">
            <dt>Incidencias activas</dt>
            {incidents.map((incident) => (
              <dd key={incident.id} data-severity={incident.severity}>
                <AlertTriangle size={12} aria-hidden="true" />
                {incidentKindLabels[incident.kind]} · {severityLabels[incident.severity]}
              </dd>
            ))}
          </div>
        )}
      </dl>
      <div className="map-selected-footer">
        <button type="button" onClick={onOpen}>
          Abrir detalle <ArrowRight size={14} />
        </button>
      </div>
    </section>
  )
}
