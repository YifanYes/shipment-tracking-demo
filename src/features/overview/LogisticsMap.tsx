import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import {
  FullscreenControl,
  GeoJSONSource,
  LngLatBounds,
  Map as LibreMap,
  Marker,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import type { FeatureCollection, Point } from 'geojson'
import type { ShipmentView } from '@/domain/contracts'
import {
  attentionReasons,
  confirmedLocation,
  hasCoordinates,
  mapRoutes,
  mapTone,
} from '@/domain/map'
import { stageLabels } from '@/features/shipments/ShipmentTracking'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)

interface Props {
  shipments: readonly ShipmentView[]
  selected: ShipmentView | null
  cutoffAt: string
  onSelect: (id: string) => void
  onClusterSelect: (ids: string[]) => void
}

interface MapMarker {
  key: string
  element: HTMLDivElement
  marker: Marker
  coordinates: [number, number]
  shipmentId?: string
  clusterId?: number
  count: number
  attention: number
}

function pointsFor(shipments: Props['shipments'], cutoffAt: string): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: shipments.flatMap((item) => {
      const location = confirmedLocation(item)
      return hasCoordinates(location)
        ? [
            {
              type: 'Feature' as const,
              properties: {
                shipmentId: item.shipment.id,
                attention: attentionReasons(item, cutoffAt).length ? 1 : 0,
              },
              geometry: { type: 'Point' as const, coordinates: [...location.coordinates] },
            },
          ]
        : []
    }),
  }
}

function duration() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 450
}

function fitOverview(map: LibreMap, shipments: Props['shipments'], cutoffAt: string) {
  const bounds = new LngLatBounds()
  mapRoutes(shipments, cutoffAt).features.forEach((feature) =>
    feature.geometry.coordinates.forEach(([longitude, latitude]) =>
      bounds.extend([longitude!, latitude!]),
    ),
  )
  shipments.forEach((item) => {
    const location = confirmedLocation(item)
    if (hasCoordinates(location)) bounds.extend([location.coordinates[0], location.coordinates[1]])
  })
  if (bounds.isEmpty()) {
    bounds.extend([-9.6, 35.7])
    bounds.extend([4.5, 43.9])
  }
  map.fitBounds(bounds, { padding: 55, duration: 0, maxZoom: 7.5 })
}

export default function LogisticsMap({
  shipments,
  selected,
  cutoffAt,
  onSelect,
  onClusterSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LibreMap | null>(null)
  const markerRef = useRef<MapMarker[]>([])
  const latest = useRef({ shipments, selected, cutoffAt })
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [baseUnavailable, setBaseUnavailable] = useState(false)
  const [markers, setMarkers] = useState<MapMarker[]>([])

  useEffect(() => {
    latest.current = { shipments, selected, cutoffAt }
  }, [shipments, selected, cutoffAt])

  useEffect(() => {
    if (!container.current) return
    let map: LibreMap
    let disposed = false
    let signature = ''
    let exitFullscreen = () => {}
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
      const features = map
        .querySourceFeatures('shipments')
        .filter((feature) => feature.geometry.type === 'Point')
      const unique = new globalThis.Map<
        string,
        {
          coordinates: [number, number]
          shipmentId?: string
          clusterId?: number
          count: number
          attention: number
        }
      >()
      features.forEach((feature) => {
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
      map.addSource('shipments', {
        type: 'geojson',
        data: pointsFor(latest.current.shipments, latest.current.cutoffAt),
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
      map.addSource('route', {
        type: 'geojson',
        data: mapRoutes(
          latest.current.shipments,
          latest.current.cutoffAt,
          latest.current.selected?.shipment.id,
        ),
      })
      map.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 7, 'line-opacity': 0.85 },
      })
      map.addLayer({
        id: 'shipment-routes',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'tone'], 'attention', '#a56a13', '#4367df'],
          'line-width': ['case', ['boolean', ['get', 'selected'], false], 4, 3],
          'line-opacity': 0.7,
        },
      })
      map.addLayer({
        id: 'selected-route',
        type: 'line',
        source: 'route',
        filter: ['==', ['get', 'selected'], true],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': ['match', ['get', 'tone'], 'attention', '#a56a13', '#4367df'],
          'line-width': 4,
        },
      })
      map.addSource('route-ends', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      })
      map.addLayer({
        id: 'route-ends',
        type: 'circle',
        source: 'route-ends',
        paint: {
          'circle-color': '#ffffff',
          'circle-radius': 5,
          'circle-stroke-color': ['match', ['get', 'tone'], 'attention', '#a56a13', '#4367df'],
          'circle-stroke-width': 2,
        },
      })
      fitOverview(map, latest.current.shipments, latest.current.cutoffAt)
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
      fitOverview(
        map,
        latest.current.selected ? [latest.current.selected] : latest.current.shipments,
        latest.current.cutoffAt,
      )
    })
    observer.observe(container.current)
    return () => {
      disposed = true
      exitFullscreen()
      observer.disconnect()
      canvas.removeEventListener('webglcontextlost', contextLost)
      markerRef.current.forEach(({ marker }) => marker.remove())
      markerRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const source = map.getSource<GeoJSONSource>('shipments')
    source?.setData(pointsFor(shipments, cutoffAt))
  }, [shipments, cutoffAt, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const routes = mapRoutes(shipments, cutoffAt, selected?.shipment.id)
    map.getSource<GeoJSONSource>('route')?.setData(routes)
  }, [shipments, cutoffAt, selected, ready])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const route = mapRoutes(selected ? [selected] : [], cutoffAt, selected?.shipment.id)
    const ends: FeatureCollection<Point> = {
      type: 'FeatureCollection',
      features: route.features.flatMap((feature) =>
        [feature.geometry.coordinates[0]!, feature.geometry.coordinates.at(-1)!].map(
          (coordinates) => ({
            type: 'Feature' as const,
            properties: { tone: feature.properties?.tone },
            geometry: { type: 'Point' as const, coordinates },
          }),
        ),
      ),
    }
    map.getSource<GeoJSONSource>('route-ends')?.setData(ends)
    const coordinates = route.features.flatMap((feature) => feature.geometry.coordinates)
    const location = selected ? confirmedLocation(selected) : undefined
    if (hasCoordinates(location)) coordinates.push([...location.coordinates])
    if (coordinates.length) {
      const bounds = new LngLatBounds()
      coordinates.forEach((coordinate) => bounds.extend(coordinate as [number, number]))
      map.fitBounds(bounds, { padding: 70, maxZoom: 7.5, duration: duration() })
    } else fitOverview(map, shipments, cutoffAt)
  }, [selected, ready, shipments, cutoffAt])

  async function expandCluster(marker: MapMarker) {
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
        aria-label="Mapa de últimas ubicaciones confirmadas de los envíos"
      />
      {failed ? (
        <output className="map-unavailable">
          <MapPinFallback />
          <strong>El mapa no está disponible</strong>
          <span>
            Puedes consultar las ubicaciones y seleccionar los envíos en la lista inferior.
          </span>
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
                if (mapRef.current) fitOverview(mapRef.current, shipments, cutoffAt)
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
          return createPortal(
            <button
              type="button"
              className="map-vehicle"
              data-tone={mapTone(item, cutoffAt)}
              aria-pressed={selected?.shipment.id === item.shipment.id}
              aria-label={`Seleccionar ${item.shipment.reference}, ${attentionReasons(item, cutoffAt).length ? 'requiere atención' : 'en curso'}, última ubicación ${location?.placeLabel ?? 'desconocida'}`}
              title={`${item.shipment.reference} · ${location?.placeLabel ?? 'Sin ubicación confirmada'}`}
              onClick={() => onSelect(item.shipment.id)}
            >
              <span className="map-vehicle-dot" aria-hidden="true" />
              {selected?.shipment.id === item.shipment.id && (
                <span className="map-vehicle-label">
                  <strong>{item.shipment.reference}</strong>
                  <small>
                    {location?.placeLabel} ·{' '}
                    {attentionReasons(item, cutoffAt).length
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

function MapPinFallback() {
  return <LocateFixed size={26} aria-hidden="true" />
}
