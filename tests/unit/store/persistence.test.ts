import { describe, expect, it } from 'vitest'
import { demoSeed } from '@/data/scenarios'
import { selectVisibleShipments } from '@/domain/selectors'
import { STORAGE_KEY, STORAGE_VERSION } from '@/store/persistence'
import { createWorkspaceStore } from '@/store/workspace-store'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

const tr004 = (store: ReturnType<typeof createWorkspaceStore>) =>
  selectVisibleShipments(store.getState()).find((item) => item.shipment.id === 'shipment-tr-004')!

describe('persistencia versionada', () => {
  it('recupera identidad, paso, acciones y documentos tras recargar', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(demoSeed, { storage })
    store.getState().setIdentity('operations-network')
    store.getState().advanceDemo()
    const provide = tr004(store).recommendations.find((item) => item.kind === 'provide_document')!
    store.getState().recordAction('shipment-tr-004', provide.id)
    store.getState().toggleSidebar()

    const reloaded = createWorkspaceStore(demoSeed, { storage })
    const state = reloaded.getState()
    expect(state).toMatchObject({
      identityId: 'operations-network',
      cutoffAt: store.getState().cutoffAt,
      sidebarCollapsed: true,
    })
    expect(state.dataset.events).toHaveLength(store.getState().dataset.events.length)
    expect(state.dataset.activity).toEqual(store.getState().dataset.activity)
    expect(tr004(reloaded).documents).toEqual(tr004(store).documents)
    expect(tr004(reloaded).incidents).toEqual(tr004(store).incidents)
  })

  it('reiniciar guarda el estado inicial', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(demoSeed, { storage })
    store.getState().setIdentity('operations-network')
    store.getState().advanceDemo()
    store.getState().resetDemo()
    const reloaded = createWorkspaceStore(demoSeed, { storage })
    expect(reloaded.getState().dataset).toBe(demoSeed.dataset)
    expect(reloaded.getState().cutoffAt).toBe(demoSeed.dataset.referenceTime)
  })

  it('descarta un estado incompatible o manipulado y empieza desde la semilla', () => {
    const valid = {
      version: STORAGE_VERSION,
      identityId: 'operations-network',
      cutoffAt: demoSeed.dataset.referenceTime,
      activity: [],
      sidebarCollapsed: false,
    }
    for (const raw of [
      '{no es json',
      JSON.stringify({ ...valid, version: STORAGE_VERSION + 1 }),
      JSON.stringify({ ...valid, identityId: 'missing' }),
      JSON.stringify({ ...valid, cutoffAt: '2026-10-31T10:30:00.000Z' }),
      JSON.stringify({ ...valid, activity: [{ id: 'activity-x', action: 'delete_shipment' }] }),
    ]) {
      const storage = memoryStorage({ [STORAGE_KEY]: raw })
      const store = createWorkspaceStore(demoSeed, { storage })
      expect(store.getState().dataset).toBe(demoSeed.dataset)
      expect(store.getState().identityId).toBe(demoSeed.dataset.identities[0]!.id)
      expect(storage.getItem(STORAGE_KEY)).toBeNull()
    }
  })

  it('descarta registros que la regla de acciones no habría producido', () => {
    const storage = memoryStorage()
    const store = createWorkspaceStore(demoSeed, { storage })
    store.getState().setIdentity('operations-network')
    const notify = tr004(store).recommendations.find((item) => item.kind === 'notify_customer')!
    store.getState().recordAction('shipment-tr-004', notify.id, 'Mensaje editado')
    const snapshot = JSON.parse(storage.getItem(STORAGE_KEY)!)
    const record = snapshot.activity[0]
    expect(createWorkspaceStore(demoSeed, { storage }).getState().dataset.activity).toHaveLength(1)
    for (const activity of [
      [{ ...record, actionId: 'action-invented' }],
      [{ ...record, incidentId: 'incident-invented' }],
      [{ ...record, recipient: 'Otra cuenta' }],
      [{ ...record, actorIdentityId: 'customer-levante' }],
      [record, record],
    ]) {
      const raw = JSON.stringify({ ...snapshot, activity })
      const restored = createWorkspaceStore(demoSeed, {
        storage: memoryStorage({ [STORAGE_KEY]: raw }),
      })
      expect(restored.getState().dataset).toBe(demoSeed.dataset)
    }
  })

  it('arranca aunque el almacenamiento no permita borrar un estado inválido', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: '{no es json' })
    storage.removeItem = () => {
      throw new Error('bloqueado')
    }
    expect(createWorkspaceStore(demoSeed, { storage }).getState().dataset).toBe(demoSeed.dataset)
  })
})

describe('reproducción', () => {
  it('solo reproduce operaciones con pasos pendientes y se detiene al cambiar de identidad', () => {
    const store = createWorkspaceStore(demoSeed)
    store.getState().setPlaying(true)
    expect(store.getState().playing).toBe(true)
    store.getState().setIdentity('customer-levante')
    expect(store.getState().playing).toBe(false)
    store.getState().setPlaying(true)
    expect(store.getState().playing).toBe(false)
    store.getState().setIdentity('operations-network')
    demoSeed.steps.forEach(() => store.getState().advanceDemo())
    store.getState().setPlaying(true)
    expect(store.getState().playing).toBe(false)
  })
})
