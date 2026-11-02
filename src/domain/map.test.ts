import { describe, expect, it } from 'vitest'
import { phaseOneDataset } from '@/data/phase-one'
import { selectVisibleShipments, selectSummary } from './selectors'
import {
  attentionReasons,
  arrivalsToday,
  confirmedLocation,
  hasCoordinates,
  mapTone,
  mapRoutes,
  updateAge,
} from './map'

const cutoffAt = phaseOneDataset.referenceTime
const item = selectVisibleShipments({
  dataset: phaseOneDataset,
  identityId: 'operations-madrid',
  cutoffAt,
  selectedShipmentId: null,
})[0]!

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
    expect(route.properties).toMatchObject({ selected: false, tone: 'transit', mode: 'road' })
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

  it('mantiene el mismo criterio de atención en mapa, lista y contadores', () => {
    expect(mapTone(item, cutoffAt)).toBe('transit')
    const stale = { ...item, projection: { ...item.projection, freshness: 'stale' as const } }
    expect(attentionReasons(stale, cutoffAt)).toContain('Información sin actualizar')
    expect(mapTone(stale, cutoffAt)).toBe('attention')
    expect(selectSummary([stale], cutoffAt).attention).toBe(1)
    const delayed = {
      ...item,
      projection: {
        ...item.projection,
        eta: {
          ...item.projection.eta,
          kind: 'operator' as const,
          arrivalAt: '2026-10-31T16:00:00Z',
          issuedAt: cutoffAt,
          operatorId: 'operator-iberia',
          evidence: [],
        },
      },
    }
    expect(attentionReasons(delayed, cutoffAt)).toContain('Llegada prevista fuera de plazo')
    expect(selectSummary([delayed], cutoffAt).attention).toBe(1)
    expect(attentionReasons(item, '2026-10-31T15:00:00Z')).toContain(
      'Entrega pendiente fuera de plazo',
    )
    expect(
      mapTone({ ...item, projection: { ...item.projection, lifecycle: 'delivered' } }, cutoffAt),
    ).toBe('delivered')
  })

  it('cuenta las llegadas de hoy en Madrid y excluye mañana, el pasado y las entregas', () => {
    const withEta = (arrivalAt: string) => ({
      ...item,
      projection: {
        ...item.projection,
        eta: {
          kind: 'operator' as const,
          arrivalAt,
          issuedAt: cutoffAt,
          operatorId: 'operator-iberia',
          evidence: [],
        },
      },
    })
    expect(
      arrivalsToday(
        [
          withEta('2026-10-31T22:30:00Z'),
          withEta('2026-10-31T23:30:00Z'),
          withEta('2026-10-31T08:00:00Z'),
        ],
        cutoffAt,
      ),
    ).toBe(1)
    expect(arrivalsToday([withEta('2026-11-01T00:15:00Z')], '2026-10-31T23:15:00Z')).toBe(1)
    expect(
      arrivalsToday(
        [{ ...item, projection: { ...item.projection, lifecycle: 'delivered' } }],
        cutoffAt,
      ),
    ).toBe(0)
    expect(updateAge(item.projection.lastConfirmedLocation?.confirmedAt, cutoffAt)).toBe(
      'Actualizado hace 1 min',
    )
    expect(updateAge(undefined, cutoffAt)).toBe('Sin ubicación confirmada')
  })
})
