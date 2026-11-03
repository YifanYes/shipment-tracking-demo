import { describe, expect, it } from 'vitest'
import { legState, mapBounds, mapPoints, mapRoutes } from '@/features/overview/lib/map-data'
import { networkSites, shipmentsAtSite } from '@/features/overview/lib/network'
import { attentionLines, attentionQueue } from '@/features/overview/lib/attention'
import {
  customsHeld,
  delivered,
  locations,
  mapCutoffAt as cutoffAt,
  mapShipments,
  multimodal,
  road,
  withoutCoordinates,
} from '@tests/support/map-fixtures'

const active = mapShipments.filter((item) => item.projection.lifecycle !== 'delivered')

describe('rutas por tramo', () => {
  it('distingue tramos completados, activo y pendientes con su modo', () => {
    const features = mapRoutes([multimodal], cutoffAt).features
    expect(features.map((feature) => feature.properties)).toEqual([
      expect.objectContaining({ legId: 'leg-multi-road-1', mode: 'road', state: 'completed' }),
      expect.objectContaining({ legId: 'leg-multi-sea', mode: 'sea', state: 'active' }),
      expect.objectContaining({ legId: 'leg-multi-road-2', mode: 'road', state: 'pending' }),
    ])
    // Each leg keeps its own itinerary instead of joining the shipment endpoints.
    expect(features[1]!.geometry.coordinates).toEqual(
      multimodal.shipment.legs[1]!.route!.coordinates,
    )
  })

  it('un envío planificado no tiene tramo activo y solo se dibuja al seleccionarlo', () => {
    const planned = {
      ...multimodal,
      projection: {
        ...multimodal.projection,
        lifecycle: 'planned' as const,
        currentLegId: 'leg-multi-road-1',
        legStages: {},
      },
    }
    expect(multimodal.shipment.legs.map((leg) => legState(planned, leg))).toEqual([
      'pending',
      'pending',
      'pending',
    ])
    expect(mapRoutes([planned], cutoffAt).features).toHaveLength(0)
    expect(mapRoutes([planned], cutoffAt, planned.shipment.id).features).toHaveLength(3)
  })

  it('resalta la ruta seleccionada y atenúa las demás', () => {
    const features = mapRoutes(active, cutoffAt, customsHeld.shipment.id).features
    for (const { properties } of features) {
      const isSelected = properties.shipmentId === customsHeld.shipment.id
      expect(properties).toMatchObject({ selected: isSelected, muted: !isSelected })
    }
    expect(new Set(features.map((feature) => feature.properties.shipmentId))).toEqual(
      new Set([multimodal.shipment.id, road.shipment.id, customsHeld.shipment.id]),
    )
  })

  it('no sitúa marcadores sin coordenadas ni envíos fuera de su última ubicación', () => {
    const points = mapPoints(active, cutoffAt).features
    expect(points.map((point) => point.properties.shipmentId)).not.toContain(
      withoutCoordinates.shipment.id,
    )
    expect(
      points.find((point) => point.properties.shipmentId === multimodal.shipment.id)?.geometry
        .coordinates,
    ).toEqual(locations.alboran.coordinates)
  })
})

describe('encuadre', () => {
  it('incluye los tramos marítimos y el destino fuera de la UE', () => {
    const [[west, south], [east, north]] = mapBounds(active, cutoffAt)!
    expect(south).toBeLessThanOrEqual(locations.casablanca.coordinates![1])
    expect(west).toBeLessThanOrEqual(locations.casablanca.coordinates![0])
    expect(north).toBeGreaterThanOrEqual(locations.zaragoza.coordinates![1])
    expect(east).toBeGreaterThanOrEqual(0.2) // Sea leg leaves the coast east of Valencia.
  })

  it('encuadra la ruta multimodal completa del envío seleccionado', () => {
    const [[west, south], [east, north]] = mapBounds(
      [multimodal],
      cutoffAt,
      multimodal.shipment.id,
    )!
    expect([west, south, east, north]).toEqual([-7.5898, 33.5731, 0.2, 40.4168])
  })

  it('sin geometría ni coordenadas no hay encuadre', () => {
    expect(mapBounds([withoutCoordinates], cutoffAt)).toBeNull()
  })
})

describe('red de centros, puertos y destinos', () => {
  it('solo muestra lugares referenciados por los envíos visibles, sin puntos de paso', () => {
    const sites = networkSites(active)
    expect(sites.map((site) => [site.id, site.kind])).toEqual([
      ['site-madrid', 'site'],
      ['site-zaragoza', 'site'],
      ['port-algeciras', 'port'],
      ['port-valencia', 'port'],
      ['port-tanger-med', 'port'],
      ['destination-casablanca', 'destination'],
      ['destination-valencia', 'destination'],
    ])
    expect(networkSites([road]).map((site) => site.id)).toEqual([
      'site-madrid',
      'destination-valencia',
    ])
    expect(networkSites([])).toEqual([])
  })

  it('filtra los envíos que pasan por el lugar o están en él', () => {
    const ids = (siteId: string) =>
      shipmentsAtSite(active, siteId).map((item) => item.shipment.reference)
    expect(ids('port-tanger-med')).toEqual(['ATL-MM-001', 'ATL-MM-002'])
    expect(ids('site-zaragoza')).toEqual(['ATL-ES-102', 'ATL-MM-002'])
    expect(ids('port-valencia')).toEqual(['ATL-MM-001'])
    expect(shipmentsAtSite([delivered], 'site-zaragoza')).toHaveLength(1)
  })
})

describe('cola de atención', () => {
  it('ordena por gravedad de la incidencia activa antes que por motivos', () => {
    const stale = {
      ...road,
      projection: { ...road.projection, freshness: 'stale' as const, unknownEventIds: ['x'] },
    }
    expect(
      attentionQueue([stale, multimodal, customsHeld, withoutCoordinates], cutoffAt).map(
        (item) => item.shipment.reference,
      ),
    ).toEqual(['ATL-MM-002', 'ATL-MM-001', 'ATL-ES-101'])
  })

  it('detalla las incidencias activas en lugar del motivo genérico', () => {
    expect(attentionLines(multimodal, cutoffAt)).toEqual([
      { key: 'incident-multi-delay', label: 'Retraso', severity: 'high', attention: 'unreviewed' },
    ])
    const stale = {
      ...multimodal,
      projection: { ...multimodal.projection, freshness: 'stale' as const },
      incidents: [
        ...multimodal.incidents,
        { ...multimodal.incidents[1]!, id: 'incident-multi-stale-2', condition: 'active' as const },
      ],
    }
    // The stale incident and the stale reason are the same fact: it is listed once.
    expect(attentionLines(stale, cutoffAt).map((line) => line.label)).toEqual([
      'Retraso',
      'Información sin actualizar',
    ])
  })
})
