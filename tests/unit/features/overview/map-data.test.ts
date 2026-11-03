import { describe, expect, it } from 'vitest'
import {
  confirmedLocation,
  hasCoordinates,
  mapRoutes,
  mapTone,
} from '@/features/overview/lib/map-data'
import { cutoffAt, operationsShipment as item } from '@tests/support/fixtures'

describe('ubicaciones y estado del mapa', () => {
  it('sitúa el envío en el punto de la A-3 confirmado por el operador', () => {
    expect(confirmedLocation(item)?.coordinates).toEqual([-3.220108, 40.148136])
    expect(confirmedLocation(item)?.id).toBe('waypoint-a3-perales')
    expect(confirmedLocation(item)?.coordinates).not.toEqual(item.origin?.coordinates)
    expect(item.shipment.legs[0]?.route?.coordinates).toContainEqual(
      confirmedLocation(item)?.coordinates,
    )
    expect(
      confirmedLocation({
        ...item,
        projection: { ...item.projection, lastConfirmedLocation: null },
      }),
    ).toBeUndefined()
    expect(hasCoordinates({ ...item.origin!, coordinates: [0, 0] })).toBe(true)
    for (const coordinates of [
      [NaN, 40],
      [181, 40],
      [3, -91],
    ] as const)
      expect(hasCoordinates({ ...item.origin!, coordinates })).toBe(false)
    expect(hasCoordinates({ ...item.origin!, coordinates: undefined })).toBe(false)
  })

  it('muestra las rutas activas completas antes de seleccionar y retira las entregadas', () => {
    const route = mapRoutes([item], cutoffAt).features[0]!
    expect(route.geometry.coordinates.length).toBeGreaterThan(100)
    expect(route.geometry.coordinates).toEqual(item.shipment.legs[0]?.route?.coordinates)
    expect(route.properties).toMatchObject({
      selected: false,
      muted: false,
      tone: 'transit',
      mode: 'road',
      state: 'active',
    })
    expect(mapRoutes([item], cutoffAt, item.shipment.id).features[0]?.properties?.selected).toBe(
      true,
    )
    for (const lifecycle of ['planned', 'delivered'] as const) {
      expect(
        mapRoutes([{ ...item, projection: { ...item.projection, lifecycle } }], cutoffAt).features,
      ).toHaveLength(0)
    }
  })

  it('usa el itinerario marítimo aportado y no inventa rectas para tramos sin trazado', () => {
    const leg = item.shipment.legs[0]!
    const sea = {
      ...item,
      shipment: {
        ...item.shipment,
        legs: [
          {
            ...leg,
            mode: 'sea' as const,
            route: {
              source: 'Itinerario del operador',
              coordinates: [
                [-0.32, 39.44],
                [0.1, 39.2],
                [1.2, 39.1],
                [2.63, 39.55],
              ] as const,
            },
          },
        ],
      },
      projection: { ...item.projection, freshness: 'stale' as const },
    }
    const route = mapRoutes([sea], cutoffAt).features[0]!
    expect(route.geometry.coordinates).toEqual(sea.shipment.legs[0]!.route.coordinates)
    expect(route.properties).toMatchObject({ tone: 'attention', mode: 'sea' })
    const withoutRoute = {
      ...item,
      shipment: { ...item.shipment, legs: [{ ...leg, route: undefined }] },
    }
    expect(mapRoutes([withoutRoute], cutoffAt).features).toHaveLength(0)
    for (const coordinates of [
      [
        [0, 40],
        [1, 40],
      ],
      [
        [0, 40],
        [NaN, 40],
        [1, 40],
      ],
      [
        [0, 40],
        [181, 40],
        [1, 40],
      ],
    ] as const) {
      const invalid = {
        ...item,
        shipment: { ...item.shipment, legs: [{ ...leg, route: { source: 'Test', coordinates } }] },
      }
      expect(mapRoutes([invalid], cutoffAt).features).toHaveLength(0)
    }
  })

  it('colorea los marcadores con el criterio de atención y el ciclo de vida', () => {
    expect(mapTone(item, cutoffAt)).toBe('transit')
    const stale = { ...item, projection: { ...item.projection, freshness: 'stale' as const } }
    expect(mapTone(stale, cutoffAt)).toBe('attention')
    expect(
      mapTone({ ...item, projection: { ...item.projection, lifecycle: 'delivered' } }, cutoffAt),
    ).toBe('delivered')
  })
})
