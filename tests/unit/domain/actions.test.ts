import { describe, expect, it } from 'vitest'
import { demoSeed } from '@/data/scenarios'
import { currentNotificationsOf, explainIncident, notificationsOf } from '@/domain/actions'
import { attentionReasons } from '@/domain/attention'
import { selectSummary, selectVisibleShipments } from '@/domain/selectors'
import { createWorkspaceStore } from '@/store/workspace-store'

const views = (store: ReturnType<typeof createWorkspaceStore>) =>
  selectVisibleShipments(store.getState())
const view = (store: ReturnType<typeof createWorkspaceStore>, id: string) =>
  views(store).find((item) => item.shipment.id === id)!
const action = (store: ReturnType<typeof createWorkspaceStore>, id: string, kind: string) =>
  view(store, id).recommendations.find((item) => item.kind === kind)!

function operationsStore() {
  const store = createWorkspaceStore(demoSeed)
  store.getState().setIdentity('operations-network')
  return store
}

describe('acciones sobre incidencias', () => {
  it('fecha la falta de noticias en el último evento, no en el umbral de antigüedad', () => {
    const store = operationsStore()
    const stale = view(store, 'shipment-es-005')
    const incident = stale.incidents.find((item) => item.kind === 'stale')!
    const last = stale.events.find((event) => event.id === incident.evidence[0]!.id)!
    expect(Date.parse(incident.openedAt)).toBeGreaterThan(Date.parse(last.occurredAt))
    const hours = Math.round(
      (Date.parse(store.getState().cutoffAt) - Date.parse(last.occurredAt)) / 3_600_000,
    )
    const { summary } = explainIncident(stale, incident, store.getState().cutoffAt)
    expect(summary).toContain('30 oct, 12:00')
    expect(summary).toContain(`(${hours} h)`)
    expect(action(store, 'shipment-es-005', 'contact_operator').message).toContain('30 oct, 12:00')
  })

  it('propone acciones con prioridad y las evidencias de su incidencia', () => {
    const store = operationsStore()
    const held = view(store, 'shipment-tr-004')
    expect(held.recommendations.map((item) => item.kind).sort()).toEqual([
      'contact_operator',
      'notify_customer',
      'provide_document',
    ])
    for (const item of held.recommendations) {
      const incident = held.incidents.find((entry) => entry.id === item.incidentId)!
      expect(incident.condition).toBe('active')
      expect(item.evidence).toEqual(incident.evidence)
      expect(item.priority).toBe('urgent')
    }
    expect(held.recommendations.find((item) => item.kind === 'notify_customer')?.explanation).toBe(
      'Levante Retail no tiene aviso de la retención.',
    )
  })

  it('aportar el documento cierra la tarea documental sin liberar la aduana', () => {
    const store = operationsStore()
    const provide = action(store, 'shipment-tr-004', 'provide_document')
    const revision = store.getState().dataset.revision
    store.getState().recordAction('shipment-tr-004', provide.id)
    const after = view(store, 'shipment-tr-004')
    expect(store.getState().dataset.revision).toBe(revision + 1)
    expect(after.documents.find((item) => item.id === provide.documentId)).toMatchObject({
      state: 'available',
      uploadedAt: store.getState().cutoffAt,
      resourcePath: `/documents/${provide.documentId}.html`,
    })
    const missing = after.incidents.find((item) => item.kind === 'missing_document')!
    // It was missing during the hold: resolving it keeps the severity it had.
    expect(missing).toMatchObject({ condition: 'cleared', attention: 'handled', severity: 'high' })
    expect(after.incidents.find((item) => item.kind === 'customs')?.condition).toBe('active')
    expect(after.projection.currentStage).toBe('customs')
    expect(after.events).toEqual(view(createWorkspaceStore(demoSeed), 'shipment-tr-004').events)
    expect(after.activity).toHaveLength(1)
  })

  it('el aviso llega solo al cliente del envío y la atención pasa a atendida', () => {
    const store = operationsStore()
    const notify = action(store, 'shipment-tr-004', 'notify_customer')
    store.getState().recordAction('shipment-tr-004', notify.id, 'Mensaje editado.')
    const customs = () =>
      view(store, 'shipment-tr-004').incidents.find((item) => item.kind === 'customs')!
    expect(customs().attention).toBe('in_progress')
    // Repeating a recorded action has no effect.
    const dataset = store.getState().dataset
    store.getState().recordAction('shipment-tr-004', notify.id)
    expect(store.getState().dataset).toBe(dataset)
    const contact = action(store, 'shipment-tr-004', 'contact_operator')
    store.getState().recordAction('shipment-tr-004', contact.id)
    expect(customs()).toMatchObject({ condition: 'active', attention: 'handled' })

    store.getState().setIdentity('customer-levante')
    const notices = notificationsOf(views(store))
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      shipmentId: 'shipment-tr-004',
      accountId: 'account-levante',
      message: 'Mensaje editado.',
    })
    // A customer can't record actions, and another account sees no notice.
    const before = store.getState().dataset
    store.getState().recordAction('shipment-tr-004', contact.id)
    expect(store.getState().dataset).toBe(before)
    store.getState().setIdentity('customer-norte')
    expect(notificationsOf(views(store))).toEqual([])
  })

  it('el aviso sale del inicio al resolverse su incidencia y sigue como historial', () => {
    const store = operationsStore()
    const notify = action(store, 'shipment-tr-004', 'notify_customer')
    expect(notify.message).not.toContain('avisaremos')
    store.getState().recordAction('shipment-tr-004', notify.id)
    const notices = () => {
      const held = view(store, 'shipment-tr-004')
      return { all: notificationsOf([held]), current: currentNotificationsOf([held]) }
    }
    expect(notices().current).toHaveLength(1)
    // Providing the document does not release the shipment: the notice is still true.
    const provide = action(store, 'shipment-tr-004', 'provide_document')
    store.getState().recordAction('shipment-tr-004', provide.id)
    expect(notices().current).toHaveLength(1)
    demoSeed.steps.forEach(() => store.getState().advanceDemo())
    expect(notices().current).toEqual([])
    expect(notices().all).toHaveLength(1)
  })

  it('una identidad sin acceso al envío no puede registrar acciones', () => {
    const store = operationsStore()
    const restricted = createWorkspaceStore(demoSeed)
    restricted.getState().setIdentity('operations-madrid')
    const visible = views(restricted).map((item) => item.shipment.id)
    const foreign = views(store).find(
      (item) => !visible.includes(item.shipment.id) && item.recommendations.length,
    )
    expect(foreign).toBeDefined()
    restricted.getState().recordAction(foreign!.shipment.id, foreign!.recommendations[0]!.id)
    restricted.getState().recordAction('shipment-tr-004', 'action-unknown')
    expect(restricted.getState().dataset.activity).toBeUndefined()
  })

  it('al terminar la demo la bandeja solo queda vacía tras aportar el documento', () => {
    const store = operationsStore()
    demoSeed.steps.forEach(() => store.getState().advanceDemo())
    expect(store.getState().cutoffAt).not.toBe(demoSeed.dataset.referenceTime)
    const pending = () =>
      views(store).filter((item) => attentionReasons(item, store.getState().cutoffAt).length)
    expect(pending().map((item) => item.shipment.reference)).toEqual(['ATL-TR-004'])
    const provide = action(store, 'shipment-tr-004', 'provide_document')
    expect(view(store, 'shipment-tr-004').recommendations).toEqual([provide])
    store.getState().recordAction('shipment-tr-004', provide.id)
    expect(pending()).toEqual([])
    expect(selectSummary(views(store), store.getState().cutoffAt).attention).toBe(0)
  })
})
