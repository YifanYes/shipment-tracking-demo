import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Anchor, Flag, LocateFixed, Minus, Plus, Ship, Truck, Warehouse } from 'lucide-react'
import {
  type ExpressionSpecification,
  FullscreenControl,
  GeoJSONSource,
  Map as LibreMap,
  Marker,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { ShipmentView } from '@/domain/contracts'
import { attentionReasons } from '@/domain/attention'
import { stageLabels } from '@/shared/lib/format'
import {
  type MapBounds,
  confirmedLocation,
  currentLeg,
  hasCoordinates,
  mapBounds,
  mapPoints,
  mapRoutes,
  mapTone,
} from '../lib/map-data'
import { type MapSite, siteKindLabels } from '../lib/network'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)

export interface LogisticsMapProps {
  shipments: readonly ShipmentView[]
  sites: readonly MapSite[]
  selected: ShipmentView | null
  selectedSiteId: string | null
  cutoffAt: string
  onSelect: (id: string) => void
  onSiteSelect: (id: string | null) => void
  onClusterSelect: (ids: string[]) => void
}

interface ShipmentMarker {
  key: string
  element: HTMLDivElement
  marker: Marker
  coordinates: [number, number]
  shipmentId?: string
  clusterId?: number
  count: number
  attention: number
}

interface SiteMarker {
  id: string
  element: HTMLDivElement
  marker: Marker
}

const IBERIA: MapBounds = [
  [-9.6, 35.7],
  [4.5, 43.9],
]
const OVERVIEW_MAX_ZOOM = 7.5
const SELECTION_MAX_ZOOM = 9
const siteIcons = { site: Warehouse, port: Anchor, destination: Flag }

const routeColor: ExpressionSpecification = [
  'case',
  ['==', ['get', 'state'], 'completed'],
  '#97a3b6',
  ['==', ['get', 'tone'], 'attention'],
  '#a56a13',
  ['==', ['get', 'tone'], 'unknown'],
  '#8592a6',
  '#4367df',
]
const routeWidth: ExpressionSpecification = [
  'case',
  ['get', 'selected'],
  4.5,
  ['==', ['get', 'state'], 'active'],
  3,
  2,
]
const routeOpacity: ExpressionSpecification = [
  'case',
  ['get', 'muted'],
  0.2,
  ['==', ['get', 'state'], 'pending'],
  0.45,
  ['==', ['get', 'state'], 'completed'],
  0.8,
  0.9,
]
const routeOrder: ExpressionSpecification = [
  'case',
  ['get', 'selected'],
  2,
  ['==', ['get', 'state'], 'active'],
  1,
  0,
]

function duration() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450
}

function overviewBounds(
  shipments: readonly ShipmentView[],
  sites: readonly MapSite[],
  cutoffAt: string,
) {
  return (
    mapBounds(
      shipments,
      cutoffAt,
      null,
      sites.map((site) => site.coordinates),
    ) ?? IBERIA
  )
}

/** Width reserved on the right for the selected vehicle's label. */
const SELECTED_LABEL_WIDTH = 110

function fit(map: LibreMap, bounds: MapBounds, maxZoom: number, animate: boolean, labelRoom = 0) {
  const { clientWidth, clientHeight } = map.getContainer()
  const base = Math.max(24, Math.min(70, Math.round(Math.min(clientWidth, clientHeight) / 7)))
  // Keep the label inside the map only when there is room for it beside the route.
  const right = clientWidth > 2 * base + labelRoom + 120 ? base + labelRoom : base
  map.fitBounds(bounds, {
    padding: { top: base, bottom: base, left: base, right },
    maxZoom,
    duration: animate ? duration() : 0,
  })
}

/** Fits the selected shipment's full multimodal route, or the whole visible network. */
function frame(
  map: LibreMap,
  {
    shipments,
    sites,
    selected,
    cutoffAt,
  }: Pick<LogisticsMapProps, 'shipments' | 'sites' | 'selected' | 'cutoffAt'>,
  animate: boolean,
) {
  const bounds = selected && mapBounds([selected], cutoffAt, selected.shipment.id)
  if (bounds) fit(map, bounds, SELECTION_MAX_ZOOM, animate, SELECTED_LABEL_WIDTH)
  else fit(map, overviewBounds(shipments, sites, cutoffAt), OVERVIEW_MAX_ZOOM, animate)
}

export default function LogisticsMap({
  shipments,
  sites,
  selected,
  selectedSiteId,
  cutoffAt,
  onSelect,
  onSiteSelect,
  onClusterSelect,
}: LogisticsMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LibreMap | null>(null)
  const markerRef = useRef<ShipmentMarker[]>([])
  const siteMarkerRef = useRef(new Map<string, SiteMarker>())
  const latest = useRef({ shipments, sites, selected, cutoffAt })
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [baseUnavailable, setBaseUnavailable] = useState(false)
  const [markers, setMarkers] = useState<ShipmentMarker[]>([])
  const [siteMarkers, setSiteMarkers] = useState<SiteMarker[]>([])
  const selectedId = selected?.shipment.id ?? null

  useEffect(() => {
    latest.current = { shipments, sites, selected, cutoffAt }
  }, [shipments, sites, selected, cutoffAt])

  useEffect(() => {
    if (!container.current) return
    let map: LibreMap
    let disposed = false
    let signature = ''
    let exitFullscreen = () => {}
    const siteMarkerMap = siteMarkerRef.current
    try {
      map = new LibreMap({
        container: container.current,
        center: [-3, 40],
        zoom: 5,
        minZoom: 2,
        maxZoom: 16,
        renderWorldCopies: false,
        attributionControl: { compact: true },
        locale: {
          'FullscreenControl.Enter': 'Ampliar mapa a pantalla completa',
          'FullscreenControl.Exit': 'Salir de pantalla completa',
          'AttributionControl.ToggleAttribution': 'Mostrar atribución del mapa',
        },
        dragRotate: false,
        pitchWithRotate: false,
        style: {
          version: 8,
          sources: {
            land: {
              type: 'geojson',
              data: '/map-land.geojson',
              attribution: '<a href="https://www.naturalearthdata.com/">Natural Earth</a>',
            },
            basemap: {
              type: 'raster',
              tileSize: 256,
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
              maxzoom: 19,
            },
          },
          layers: [
            { id: 'water', type: 'background', paint: { 'background-color': '#e8eff4' } },
            {
              id: 'land',
              type: 'fill',
              source: 'land',
              paint: { 'fill-color': '#f6f7f4', 'fill-outline-color': '#ced8df' },
            },
            {
              id: 'basemap',
              type: 'raster',
              source: 'basemap',
              paint: { 'raster-saturation': -0.7, 'raster-opacity': 0.85 },
            },
          ],
        },
      })
      mapRef.current = map
      map.touchZoomRotate.disableRotation()
      const surface = container.current.closest<HTMLElement>('.map-surface')!
      const fullscreen = new FullscreenControl({ container: surface })
      map.addControl(fullscreen, 'top-right')
      let previousOverflow: string | undefined
      const restoreScroll = () => {
        if (previousOverflow === undefined) return
        document.body.style.overflow = previousOverflow
        previousOverflow = undefined
      }
      fullscreen.on('fullscreenstart', () => {
        previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
      })
      fullscreen.on('fullscreenend', () => {
        restoreScroll()
        surface.querySelector<HTMLButtonElement>('.maplibregl-ctrl-fullscreen')?.focus()
      })
      const onEscape = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && surface.classList.contains('maplibregl-pseudo-fullscreen')) {
          surface.querySelector<HTMLButtonElement>('.maplibregl-ctrl-shrink')?.click()
        }
      }
      document.addEventListener('keydown', onEscape)
      exitFullscreen = () => {
        document.removeEventListener('keydown', onEscape)
        restoreScroll()
        if (document.fullscreenElement === surface) void document.exitFullscreen().catch(() => {})
        surface.classList.remove('maplibregl-pseudo-fullscreen')
      }
    } catch {
      // The WebGL constructor is an external system and can fail synchronously.
      // oxlint-disable-next-line react/set-state-in-effect
      setFailed(true)
      return
    }

    const refreshMarkers = () => {
      if (disposed || !map.getSource('shipments')) return
      const unique = new globalThis.Map<
        string,
        Pick<ShipmentMarker, 'coordinates' | 'shipmentId' | 'clusterId' | 'count' | 'attention'>
      >()
      map.querySourceFeatures('shipments').forEach((feature) => {
        if (feature.geometry.type !== 'Point') return
        const properties = feature.properties
        const clusterId = properties.cluster ? Number(properties.cluster_id) : undefined
        const shipmentId = clusterId === undefined ? String(properties.shipmentId) : undefined
        const item = latest.current.shipments.find((entry) => entry.shipment.id === shipmentId)
        if (shipmentId && !item) return
        const location = item ? confirmedLocation(item) : undefined
        const key = clusterId === undefined ? `shipment-${shipmentId}` : `cluster-${clusterId}`
        unique.set(key, {
          coordinates: hasCoordinates(location)
            ? [location.coordinates[0], location.coordinates[1]]
            : (feature.geometry.coordinates.slice(0, 2) as [number, number]),
          shipmentId,
          clusterId,
          count: Number(properties.point_count ?? 1),
          attention: Number(properties.attention ?? 0),
        })
      })
      const nextSignature = JSON.stringify(
        [...unique.entries()].sort(([a], [b]) => a.localeCompare(b)),
      )
      if (nextSignature === signature) return
      signature = nextSignature
      const existing = new globalThis.Map(markerRef.current.map((marker) => [marker.key, marker]))
      const next = [...unique.entries()].map(([key, feature]) => {
        const previous = existing.get(key)
        if (previous) {
          existing.delete(key)
          previous.marker.setLngLat(feature.coordinates)
          return { ...previous, ...feature }
        }
        const element = document.createElement('div')
        element.className = 'logistics-marker-host'
        const marker = new Marker({ element, anchor: 'center' })
          .setLngLat(feature.coordinates)
          .addTo(map)
        return { ...feature, key, element, marker }
      })
      existing.forEach(({ marker }) => marker.remove())
      markerRef.current = next
      setMarkers(next)
    }

    map.on('load', () => {
      if (disposed) return
      const initial = latest.current
      map.addSource('shipments', {
        type: 'geojson',
        data: mapPoints(initial.shipments, initial.cutoffAt),
        cluster: true,
        clusterRadius: 48,
        clusterMaxZoom: 16,
        clusterProperties: { attention: ['+', ['get', 'attention']] },
      })
      // A source needs a visible layer to load its tiles; the actual controls are accessible DOM markers.
      map.addLayer({
        id: 'shipment-anchors',
        type: 'circle',
        source: 'shipments',
        paint: { 'circle-radius': 1, 'circle-opacity': 0 },
      })
      map.addSource('routes', {
        type: 'geojson',
        data: mapRoutes(initial.shipments, initial.cutoffAt, initial.selected?.shipment.id),
      })
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'routes',
        layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': routeOrder },
        paint: {
          'line-color': '#ffffff',
          'line-width': ['+', routeWidth, 3],
          'line-opacity': ['case', ['get', 'muted'], 0.25, 0.8],
        },
      })
      for (const mode of ['road', 'sea'] as const) {
        map.addLayer({
          id: `routes-${mode}`,
          type: 'line',
          source: 'routes',
          filter: ['==', ['get', 'mode'], mode],
          layout: {
            'line-cap': mode === 'sea' ? 'butt' : 'round',
            'line-join': 'round',
            'line-sort-key': routeOrder,
          },
          paint: {
            'line-color': routeColor,
            'line-width': routeWidth,
            'line-opacity': routeOpacity,
            ...(mode === 'sea' && { 'line-dasharray': [2, 1.5] }),
          },
        })
      }
      setReady(true)
    })
    map.on('render', refreshMarkers)
    map.on('error', (event) => {
      if (disposed) return
      const sourceId = 'sourceId' in event ? event.sourceId : undefined
      if (sourceId === 'basemap') setBaseUnavailable(true)
      else if (!sourceId) setFailed(true)
    })
    const canvas = map.getCanvas()
    const contextLost = () => {
      if (!disposed) setFailed(true)
    }
    canvas.addEventListener('webglcontextlost', contextLost)
    const observer = new ResizeObserver(() => {
      map.resize()
      frame(map, latest.current, false)
    })
    observer.observe(container.current)
    return () => {
      disposed = true
      exitFullscreen()
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', contextLost)
      markerRef.current.forEach(({ marker }) => marker.remove())
      markerRef.current = []
      siteMarkerMap.forEach(({ marker }) => marker.remove())
      siteMarkerMap.clear()
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    mapRef.current?.getSource<GeoJSONSource>('shipments')?.setData(mapPoints(shipments, cutoffAt))
  }, [shipments, cutoffAt, ready])

  useEffect(() => {
    if (!ready) return
    mapRef.current
      ?.getSource<GeoJSONSource>('routes')
      ?.setData(mapRoutes(shipments, cutoffAt, selectedId))
  }, [shipments, cutoffAt, selectedId, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const existing = siteMarkerRef.current
    const next = new Map<string, SiteMarker>()
    for (const site of sites) {
      const coordinates: [number, number] = [site.coordinates[0], site.coordinates[1]]
      const previous = existing.get(site.id)
      if (previous) {
        previous.marker.setLngLat(coordinates)
        next.set(site.id, previous)
        existing.delete(site.id)
        continue
      }
      const element = document.createElement('div')
      element.className = 'map-site-host'
      const marker = new Marker({ element, anchor: 'bottom' }).setLngLat(coordinates).addTo(map)
      next.set(site.id, { id: site.id, element, marker })
    }
    existing.forEach(({ marker }) => marker.remove())
    siteMarkerRef.current = next
    // Marker hosts are created by MapLibre outside React; the portals need them as state.
    // oxlint-disable-next-line react/set-state-in-effect
    setSiteMarkers([...next.values()])
  }, [sites, ready])

  // Frame once per selection change, not on every data refresh, so the user's camera is kept.
  useEffect(() => {
    const map = mapRef.current
    if (map && ready) frame(map, latest.current, selectedId !== null)
  }, [selectedId, ready])

  async function expandCluster(marker: ShipmentMarker) {
    const map = mapRef.current
    const source = map?.getSource<GeoJSONSource>('shipments')
    if (!map || !source || marker.clusterId === undefined) return
    try {
      const [leaves, zoom] = await Promise.all([
        source.getClusterLeaves(marker.clusterId, marker.count, 0),
        source.getClusterExpansionZoom(marker.clusterId),
      ])
      if (map !== mapRef.current) return
      onClusterSelect(leaves.map((feature) => String(feature.properties?.shipmentId)))
      map.easeTo({ center: marker.coordinates, zoom: Math.min(zoom, 12), duration: duration() })
    } catch {
      // A cluster can disappear while a fresh operator event updates the source.
    }
  }

  return (
    <>
      <div
        ref={container}
        className="logistics-map"
        aria-label="Mapa de rutas, centros y últimas ubicaciones confirmadas"
      />
      {failed ? (
        <output className="map-unavailable">
          <LocateFixed size={26} aria-hidden="true" />
          <strong>El mapa no está disponible</strong>
          <span>Puedes consultar y seleccionar los envíos en la lista inferior.</span>
        </output>
      ) : (
        <>
          <div className="map-controls" aria-label="Controles del mapa">
            <button
              type="button"
              aria-label="Acercar mapa"
              disabled={!ready}
              onClick={() => mapRef.current?.zoomIn({ duration: duration() })}
            >
              <Plus size={17} />
            </button>
            <button
              type="button"
              aria-label="Alejar mapa"
              disabled={!ready}
              onClick={() => mapRef.current?.zoomOut({ duration: duration() })}
            >
              <Minus size={17} />
            </button>
            <button
              type="button"
              aria-label="Ver toda la operación"
              disabled={!ready}
              onClick={() => {
                if (mapRef.current)
                  fit(
                    mapRef.current,
                    overviewBounds(shipments, sites, cutoffAt),
                    OVERVIEW_MAX_ZOOM,
                    true,
                  )
              }}
            >
              <LocateFixed size={17} />
            </button>
          </div>
          {baseUnavailable && (
            <output className="map-basemap-note">
              Mapa simplificado · cartografía detallada no disponible
            </output>
          )}
        </>
      )}
      {!failed &&
        siteMarkers.map(({ id, element }) => {
          const site = sites.find((entry) => entry.id === id)
          if (!site) return null
          const Icon = siteIcons[site.kind]
          const pressed = site.id === selectedSiteId
          return createPortal(
            <button
              type="button"
              className="map-site"
              data-kind={site.kind}
              aria-pressed={pressed}
              aria-label={`Filtrar envíos por ${site.name}`}
              title={`${siteKindLabels[site.kind]} · ${site.name}`}
              onClick={() => onSiteSelect(pressed ? null : site.id)}
            >
              <span className="map-site-badge" aria-hidden="true">
                <Icon size={12} />
              </span>
              {pressed && <span className="map-site-label">{site.name}</span>}
            </button>,
            element,
            `site-${id}`,
          )
        })}
      {!failed &&
        markers.map((marker) => {
          if (marker.clusterId !== undefined)
            return createPortal(
              <button
                type="button"
                className="map-cluster"
                data-tone={marker.attention ? 'attention' : 'transit'}
                aria-label={`${marker.count} envíos agrupados, ${marker.attention} requieren atención. Ampliar zona`}
                onClick={() => void expandCluster(marker)}
              >
                <strong>{marker.count}</strong>
                {marker.attention > 0 && <small>{marker.attention} con atención</small>}
              </button>,
              marker.element,
              marker.key,
            )
          const item = shipments.find((entry) => entry.shipment.id === marker.shipmentId)
          if (!item) return null
          const location = confirmedLocation(item)
          const isSelected = item.shipment.id === selectedId
          const needsAttention = attentionReasons(item, cutoffAt).length > 0
          const Icon = currentLeg(item)?.mode === 'sea' ? Ship : Truck
          return createPortal(
            <button
              type="button"
              className="map-vehicle"
              data-tone={mapTone(item, cutoffAt)}
              aria-pressed={isSelected}
              aria-label={`Seleccionar ${item.shipment.reference}, ${needsAttention ? 'requiere atención' : 'en curso'}, última ubicación ${location?.placeLabel ?? 'desconocida'}`}
              title={`${item.shipment.reference} · ${location?.placeLabel ?? 'Sin ubicación confirmada'}`}
              onClick={() => onSelect(item.shipment.id)}
            >
              <span className="map-vehicle-dot" aria-hidden="true">
                <Icon size={12} strokeWidth={2.4} />
              </span>
              {isSelected && (
                <span className="map-vehicle-label">
                  <strong>{item.shipment.reference}</strong>
                  <small>
                    {location?.placeLabel} ·{' '}
                    {needsAttention
                      ? 'Revisar'
                      : item.projection.currentStage
                        ? stageLabels[item.projection.currentStage]
                        : 'Sin estado'}
                  </small>
                </span>
              )}
            </button>,
            marker.element,
            marker.key,
          )
        })}
    </>
  )
}
