import { describe, expect, it } from 'vitest'
import { phaseOneDataset, phaseOneScenario } from '@/data/phase-one'
import type { DemoIdentity, OperatorEvent } from './contracts'
import { canViewShipment, normalizeEvent, projectShipment, shipmentEvents } from './tracking'
import { selectSelectedShipment, selectSummary, selectVisibleShipments } from './selectors'
import { createWorkspaceStore } from '@/store/use-workspace-store'

const shipment = phaseOneDataset.shipments[0]!
const transit = phaseOneDataset.events[1]!
const delivered = phaseOneScenario.scheduledEvents[0]!.event
const project = (events: readonly OperatorEvent[], cutoffAt = '2026-10-31T12:00:00.000Z') =>
  projectShipment({ ...phaseOneDataset, events }, shipment, cutoffAt)

describe('perímetro y selección', () => {
  it('exige centro y cuenta a operaciones, y cuenta exacta al cliente', () => {
    const operations = phaseOneDataset.identities[0]!
    expect(canViewShipment(operations, shipment)).toBe(true)
    expect(canViewShipment(phaseOneDataset.identities[1]!, shipment)).toBe(false)
    const customer: DemoIdentity = {
      id: 'owner',
      name: 'Cliente propietario',
      role: 'customer',
      accountId: shipment.accountId,
    }
    expect(canViewShipment(customer, shipment)).toBe(true)
    for (const [allowedOriginSiteIds, allowedAccountIds] of [
      [[], [shipment.accountId]],
      [[shipment.originSiteId], []],
      [['other'], [shipment.accountId]],
      [[shipment.originSiteId], ['other']],
    ]) {
      expect(
        canViewShipment(
          {
            id: 'limited',
            name: 'Limitado',
            role: 'operations',
            allowedOriginSiteIds: allowedOriginSiteIds!,
            allowedAccountIds: allowedAccountIds!,
          },
          shipment,
        ),
      ).toBe(false)
    }
  })

  it('limpia la selección al cambiar de identidad y rechaza un ID ajeno o desconocido', () => {
    const store = createWorkspaceStore()
    store.getState().selectShipment(shipment.id)
    expect(selectSelectedShipment(store.getState())?.shipment.id).toBe(shipment.id)
    store.getState().setIdentity('customer-levante')
    store.getState().selectShipment(shipment.id)
    expect(store.getState().selectedShipmentId).toBeNull()
    expect(selectVisibleShipments(store.getState())).toEqual([])
    expect(selectSelectedShipment(store.getState())).toBeNull()
    expect(
      selectSummary(selectVisibleShipments(store.getState()), store.getState().cutoffAt),
    ).toEqual({ active: 0, delivered: 0, attention: 0, upcoming: 0 })
    store.getState().advanceDemo()
    expect(store.getState().dataset).toBe(phaseOneDataset)
    store.getState().setIdentity('operations-madrid')
    expect(store.getState().selectedShipmentId).toBeNull()
    store.getState().selectShipment('missing')
    expect(selectSelectedShipment(store.getState())).toBeNull()
    expect(selectVisibleShipments({ ...store.getState(), identityId: 'missing' })).toEqual([])
  })
})

describe('hechos y proyección compartida', () => {
  it('conserva fuente de ETA y ubicación sin convertir la animación en un hecho', () => {
    const result = project(phaseOneDataset.events, phaseOneDataset.referenceTime)
    expect(result).toMatchObject({
      lifecycle: 'active',
      currentStage: 'in_transit',
      freshness: 'current',
      lastConfirmedLocation: { locationId: 'waypoint-a3-perales', evidence: { id: transit.id } },
    })
    expect(result.eta).toEqual({
      kind: 'operator',
      arrivalAt: '2026-10-31T12:00:00.000Z',
      issuedAt: transit.occurredAt,
      operatorId: transit.operatorId,
      evidence: [{ kind: 'operator_event', id: transit.id }],
    })
  })

  it('no inventa progreso, ubicación ni ETA para un código desconocido', () => {
    const unknown = {
      ...transit,
      id: 'unknown',
      rawCode: 'MYSTERY',
      locationId: 'destination-valencia',
    }
    expect(normalizeEvent(unknown).mapping).toBe('unknown')
    expect(normalizeEvent({ ...transit, operatorId: 'other-operator' }).mapping).toBe('unknown')
    expect(project([unknown])).toMatchObject({
      lifecycle: 'planned',
      currentStage: 'planned',
      eta: { kind: 'unavailable' },
      lastConfirmedLocation: null,
      unknownEventIds: ['unknown'],
    })
  })

  it('ordena por fecha del hecho, deduplica IDs y no retrocede por un evento tardío', () => {
    const lateOldEvent = { ...transit, receivedAt: delivered.receivedAt }
    const result = project([delivered, lateOldEvent, delivered, phaseOneDataset.events[0]!])
    expect(result).toMatchObject({
      lifecycle: 'delivered',
      currentStage: 'completed',
      lastConfirmedLocation: { locationId: 'destination-valencia' },
    })
    expect(
      shipmentEvents(
        { ...phaseOneDataset, events: [delivered, lateOldEvent, delivered] },
        shipment,
        delivered.receivedAt,
      ).map((event) => event.id),
    ).toEqual([transit.id, delivered.id])
    const laterRegression = {
      ...transit,
      id: 'regression',
      occurredAt: '2026-10-31T13:00:00.000Z',
      receivedAt: '2026-10-31T13:00:00.000Z',
    }
    expect(project([delivered, laterRegression], laterRegression.receivedAt).currentStage).toBe(
      'completed',
    )
  })

  it('no muestra hechos futuros ni eventos todavía no recibidos', () => {
    const notReceived = { ...delivered, occurredAt: '2026-10-31T09:45:00.000Z' }
    expect(
      project([...phaseOneDataset.events, delivered, notReceived], phaseOneDataset.referenceTime)
        .currentStage,
    ).toBe('in_transit')
  })

  it('excluye eventos de otro tramo u operador', () => {
    expect(
      project([
        { ...delivered, legId: 'other' },
        { ...delivered, operatorId: 'other' },
      ]).lifecycle,
    ).toBe('planned')
  })

  it('separa antigüedad y ETA de la fecha comprometida', () => {
    expect(project([], phaseOneDataset.referenceTime)).toMatchObject({
      freshness: 'no_data',
      eta: { kind: 'unavailable' },
    })
    expect(project(phaseOneDataset.events, '2026-10-31T15:00:00.000Z')).toMatchObject({
      currentStage: 'in_transit',
      freshness: 'stale',
    })
    expect(project([{ ...transit, payload: { arrivalAt: 'bad-date' } }]).eta.kind).toBe(
      'unavailable',
    )
    expect(shipment.committedDeliveryAt).toBe('2026-10-31T14:00:00.000Z')
  })
})

describe('evento reproducible del recorrido', () => {
  it('actualiza detalle y contadores una sola vez y reinicia el mismo escenario', () => {
    const store = createWorkspaceStore()
    store.getState().selectShipment(shipment.id)
    const initial = selectVisibleShipments(store.getState())
    expect(selectSummary(initial, store.getState().cutoffAt)).toMatchObject({
      active: 1,
      upcoming: 1,
      delivered: 0,
    })
    store.getState().advanceDemo()
    const result = store.getState()
    expect(result.selectedShipmentId).toBe(shipment.id)
    expect(result.cutoffAt).toBe(delivered.receivedAt)
    expect(selectSummary(selectVisibleShipments(result), result.cutoffAt)).toEqual({
      active: 0,
      upcoming: 0,
      delivered: 1,
      attention: 0,
    })
    expect(selectSelectedShipment(result)?.projection.lifecycle).toBe('delivered')
    expect(result.dataset.events).toHaveLength(3)
    store.getState().advanceDemo()
    expect(store.getState().dataset).toBe(result.dataset)
    expect(store.getState().cutoffAt).toBe(result.cutoffAt)
    store.getState().resetDemo()
    expect(store.getState()).toMatchObject({
      dataset: phaseOneDataset,
      cutoffAt: phaseOneDataset.referenceTime,
      selectedShipmentId: null,
    })
  })
})
