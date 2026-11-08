import { describe, expect, it } from 'vitest'
import { selectSelectedShipment, selectSummary, selectVisibleShipments } from '@/domain/selectors'
import { nationalDataset, nationalScenario } from '@/data/scenarios/national'
import { nationalSeed } from '@/data/scenarios'
import { createWorkspaceStore } from '@/store/workspace-store'

const shipment = nationalDataset.shipments[0]!
const delivered = nationalScenario.scheduledEvents[0]!.event

describe('perímetro de la sesión', () => {
  it('limpia la selección al cambiar de identidad y rechaza un ID ajeno o desconocido', () => {
    const store = createWorkspaceStore(nationalSeed)
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
    store.getState().setIdentity('operations-madrid')
    expect(store.getState().selectedShipmentId).toBeNull()
    store.getState().selectShipment('missing')
    expect(selectSelectedShipment(store.getState())).toBeNull()
    expect(selectVisibleShipments({ ...store.getState(), identityId: 'missing' })).toEqual([])
  })
})

describe('evento reproducible del recorrido', () => {
  it('actualiza detalle y contadores una sola vez y reinicia el mismo escenario', () => {
    const store = createWorkspaceStore(nationalSeed)
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
      dataset: nationalDataset,
      cutoffAt: nationalDataset.referenceTime,
      selectedShipmentId: null,
    })
  })
})
